/* Originally written by Bartek Drozdz, MIT License
   http://www.everyday3d.com/blog/index.php/2010/05/24/loading-3d-models-runtime-unity3d/
   Modified for use in Kilroy:
     Class name OBJ => ObjMesh.
     Adds colider when mesh is ready. (FIXME: adds bounding box collider. Maybe use MeshCollider if the number of faces are less than 256?)
     Separated ObjUtil.
     Separated Mtllib.
     Fix bug where no mtllib doesn't default to "default" material.
     Load must be called explicitly, so that we can know when a (e.g., yielded) call is done.
 */
using UnityEngine;
using System;
using System.Collections;
using System.Collections.Generic;

public class ObjMesh : MonoBehaviour {
	
	public string objPath;
	
	/* OBJ file tags */
	private const string O 	= "o";
	private const string G 	= "g";
	private const string V 	= "v";
	private const string VT = "vt";
	private const string VN = "vn";
	private const string F 	= "f";
	private const string MTL = "mtllib";
	private const string UML = "usemtl";
	
	private string basepath;
	private string mtllib;
	private GeometryBuffer buffer;

	void Start ()
	{
		buffer = new GeometryBuffer ();
		//StartCoroutine (Load (objPath));  // The Load coroutine must be explicitly called, so it can be yielded within other coroutines.
	}
	
	public IEnumerator Load(string path) {
		objPath = path;
		basepath = (path.IndexOf("/") == -1) ? "" : path.Substring(0, path.LastIndexOf("/") + 1);
		
		WWW loader = new WWW(path);
		yield return loader;
		SetGeometryData(loader.text);
		
		Mtllib lib = new Mtllib();
		if(hasMaterials) {
			int ii = 0;
			loader = new WWW(basepath + mtllib);
			yield return loader;
			string[] filenames = lib.Load(loader.text);
			foreach(String filename in filenames) {
				if (filename != null) {
					WWW texloader = new WWW(basepath + filename);
					yield return texloader;
					lib.SetTexture(ii++, texloader.texture);
				}
			}
		}
		Build(lib);
	}

	private void SetGeometryData(string data) {
		string[] lines = data.Split("\n".ToCharArray());
		
		for(int i = 0; i < lines.Length; i++) {
			string l = lines[i];
			
			if(l.IndexOf("#") != -1) l = l.Substring(0, l.IndexOf("#"));
			string[] p = l.Split(" ".ToCharArray());
			
			switch(p[0]) {
				case O:
					buffer.PushObject(p[1].Trim());
					break;
				case G:
					buffer.PushGroup(p[1].Trim());
					break;
				case V:
					buffer.PushVertex( new Vector3( ObjUtil.cf(p[1]), ObjUtil.cf(p[2]), ObjUtil.cf(p[3]) ) );
					break;
				case VT:
					buffer.PushUV(new Vector2( ObjUtil.cf(p[1]), ObjUtil.cf(p[2]) ));
					break;
				case VN:
					buffer.PushNormal(new Vector3( ObjUtil.cf(p[1]), ObjUtil.cf(p[2]), ObjUtil.cf(p[3]) ));
					break;
				case F:
					for(int j = 1; j < p.Length; j++) {
						string[] c = p[j].Trim().Split("/".ToCharArray());
						FaceIndices fi = new FaceIndices();
						fi.vi = ObjUtil.ci(c[0])-1;	
						if(c.Length > 1 && c[1] != "") fi.vu = ObjUtil.ci(c[1])-1;
						if(c.Length > 2 && c[2] != "") fi.vn = ObjUtil.ci(c[2])-1;
						buffer.PushFace(fi);
					}
					break;
				case MTL:
					mtllib = p[1].Trim();
					break;
				case UML:
					buffer.PushMaterialName(p[1].Trim());
					break;
			}
		}
		
		// buffer.Trace();
	}
		
	private bool hasMaterials {
		get {
			return mtllib != null;
		}
	}

	private void Build(Mtllib lib) {
		Dictionary<string, Material> materials = lib.Build(hasMaterials);
		
		GameObject[] ms = new GameObject[buffer.numObjects];
		
		if(buffer.numObjects == 1) {
			gameObject.AddComponent(typeof(MeshFilter));
			gameObject.AddComponent(typeof(MeshRenderer));
			ms[0] = gameObject;
		} else if(buffer.numObjects > 1) {
			for(int i = 0; i < buffer.numObjects; i++) {
				GameObject go = new GameObject();
				go.transform.parent = gameObject.transform;
				go.AddComponent(typeof(MeshFilter));
				go.AddComponent(typeof(MeshRenderer));
				ms[i] = go;
			}
		}
		
		buffer.PopulateMeshes(ms, materials);
		gameObject.AddComponent(typeof(BoxCollider));
	}
}








