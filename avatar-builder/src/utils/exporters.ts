import { BufferGeometry, Group, Matrix3, Mesh, Object3D, Vector3 } from "three";

const isRenderableMesh = (object: Object3D): object is Mesh =>
  (object as Mesh).isMesh === true;

const formatNumber = (value: number) => {
  return Number.parseFloat(value.toFixed(6));
};

const collectMeshes = (root: Group) => {
  const vertices: number[] = [];
  const normals: number[] = [];

  const vertex = new Vector3();
  const normal = new Vector3();
  const normalMatrix = new Matrix3();

  root.updateWorldMatrix(true, true);

  root.traverse((child) => {
    if (!isRenderableMesh(child)) return;

    const mesh = child;

    const geometry = mesh.geometry as BufferGeometry;
    if (!geometry) return;

    const worldMatrix = mesh.matrixWorld.clone();
    normalMatrix.getNormalMatrix(worldMatrix);

    const tempGeometry = geometry.toNonIndexed();
    const positionAttribute = tempGeometry.getAttribute("position");
    const normalAttribute = tempGeometry.getAttribute("normal");

    for (let i = 0; i < positionAttribute.count; i += 1) {
      vertex.fromBufferAttribute(positionAttribute, i);
      vertex.applyMatrix4(worldMatrix);
      vertices.push(formatNumber(vertex.x), formatNumber(vertex.y), formatNumber(vertex.z));

      if (normalAttribute) {
        normal.fromBufferAttribute(normalAttribute, i);
        normal.applyMatrix3(normalMatrix).normalize();
        normals.push(formatNumber(normal.x), formatNumber(normal.y), formatNumber(normal.z));
      } else {
        normals.push(0, 1, 0);
      }
    }

    tempGeometry.dispose();
  });

  return { vertices, normals };
};

export const exportAvatarAsFBX = (group: Group) => {
  const { vertices, normals } = collectMeshes(group);
  const vertexCount = vertices.length / 3;
  const polygonCount = Math.floor(vertexCount / 3);

  const polygonIndices: number[] = [];
  for (let i = 0; i < polygonCount; i += 1) {
    const base = i * 3;
    polygonIndices.push(base, base + 1, -(base + 2 + 1));
  }

  const now = new Date();

  const serialize = (values: number[]) => values.join(",");

  const header = `; FBX 7.4.0 project file\n`
    + `FBXHeaderExtension:  {\n`
    + `  FBXHeaderVersion: 1003\n`
    + `  FBXVersion: 7400\n`
    + `  CreationTimeStamp:  {\n`
    + `    Version: 1000\n`
    + `    Year: ${now.getUTCFullYear()}\n`
    + `    Month: ${now.getUTCMonth() + 1}\n`
    + `    Day: ${now.getUTCDate()}\n`
    + `    Hour: ${now.getUTCHours()}\n`
    + `    Minute: ${now.getUTCMinutes()}\n`
    + `    Second: ${now.getUTCSeconds()}\n`
    + `    Millisecond: ${now.getUTCMilliseconds()}\n`
    + `  }\n`
    + `  Creator: "Avatar Forge Exporter"\n`
    + `}\n`;

  const globals = `GlobalSettings:  {\n`
    + `  Version: 1000\n`
    + `  Properties70:  {\n`
    + `    P: "UpAxis", "int", "Integer", "",1\n`
    + `    P: "UpAxisSign", "int", "Integer", "",1\n`
    + `    P: "FrontAxis", "int", "Integer", "",2\n`
    + `    P: "FrontAxisSign", "int", "Integer", "",1\n`
    + `    P: "CoordinateAxis", "int", "Integer", "",0\n`
    + `    P: "CoordinateAxisSign", "int", "Integer", "",1\n`
    + `    P: "UnitScaleFactor", "double", "Number", "",1.0\n`
    + `  }\n`
    + `}\n`;

  const definitions = `Definitions:  {\n`
    + `  Version: 100\n`
    + `  Count: 2\n`
    + `  ObjectType: "Geometry" {\n`
    + `    Count: 1\n`
    + `  }\n`
    + `  ObjectType: "Model" {\n`
    + `    Count: 1\n`
    + `  }\n`
    + `}\n`;

  const objects = `Objects:  {\n`
    + `  Geometry: 1, "Geometry::Avatar", "Mesh" {\n`
    + `    Vertices: *${vertices.length} {\n`
    + `      a: ${serialize(vertices)}\n`
    + `    }\n`
    + `    PolygonVertexIndex: *${polygonIndices.length} {\n`
    + `      a: ${serialize(polygonIndices)}\n`
    + `    }\n`
    + `    GeometryVersion: 124\n`
    + `    LayerElementNormal: 0 {\n`
    + `      Version: 102\n`
    + `      Name: ""\n`
    + `      MappingInformationType: "ByPolygonVertex"\n`
    + `      ReferenceInformationType: "Direct"\n`
    + `      Normals: *${normals.length} {\n`
    + `        a: ${serialize(normals)}\n`
    + `      }\n`
    + `    }\n`
    + `  }\n`
    + `  Model: 2, "Model::Avatar", "Mesh" {\n`
    + `    Version: 232\n`
    + `    Properties70:  {\n`
    + `      P: "Lcl Translation", "Lcl Translation", "", "A",0,0,0\n`
    + `      P: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0\n`
    + `      P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1\n`
    + `    }\n`
    + `    Shading: Y\n`
    + `    Culling: "CullingOff"\n`
    + `  }\n`
    + `}\n`;

  const connections = `Connections:  {\n`
    + `  C: "OO",1,2\n`
    + `}\n`;

  const content = `${header}${globals}${definitions}${objects}${connections}`;
  return new Blob([content], { type: "application/octet-stream" });
};

export const exportAvatarAsGLTF = async (group: Group) => {
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  return new Promise<Blob>((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      group,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: "model/gltf-binary" }));
        } else {
          const json = JSON.stringify(result, null, 2);
          resolve(new Blob([json], { type: "model/gltf+json" }));
        }
      },
      (error) => {
        if (error instanceof ErrorEvent) {
          reject(new Error(error.message));
        } else {
          reject(error as Error);
        }
      },
      { onlyVisible: true, embedImages: true, forceIndices: true },
    );
  });
};
