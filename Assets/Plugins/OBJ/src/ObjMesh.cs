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
		if (objPath != null) StartCoroutine(Load(objPath)); // fixme remove after testing
	}
	
	private WWW loader;
	private string defaultTexturePath;
	public IEnumerator Load(string path) {
		objPath = path;
		int baseStart = path.LastIndexOf("/");
		basepath = (baseStart == -1) ? "" : path.Substring(0, baseStart + 1);
		Debug.Log("Loading " + path + " base:" + basepath);
		defaultTexturePath = ((baseStart == -1) ? path.Split(".".ToCharArray())[0] : (basepath + path.Substring(baseStart + 1).Split(".".ToCharArray())[0])) + ".jpg";
				
		loader = new WWW(path);
		yield return loader;
		SetGeometryData(loader.text);
		
		if(hasMaterials) {
			Debug.Log("Loading material " + basepath + mtllib);
			loader = new WWW(basepath + mtllib);
			yield return loader;

		}
		Build();
	}

	// Assigns a GameObject for each object in the data buffer, with MeshFilter and MeshRenderer components for each.
	// If there's just one object, our gameObject is used directly. Otherwise each new GameObject is a child of us.
	// We (synchonously) parse the loader.text into a new dictionary of materials.
	// Each GameObject is assigned the sharedMaterials fetched from the dictionary.
	// Finally, a BoxCollider is added for us as a whole.
	private void Build() {
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
		ResourceLoader.instance.logging = 6;
		ResourceLoader.instance.defaultTexturePath = defaultTexturePath;
		Dictionary<string, Material> materials = ResourceLoader.instance.ParseInto(basepath, hasMaterials ? loader.text : null, new Dictionary<string, Material>());
		string[][] names = new string[buffer.numObjects][];
		buffer.PopulateMeshes(ms, names);
		for (int ii = 0; ii < buffer.numObjects; ii++) StartCoroutine( ResourceLoader.instance.FetchMaterials(names[ii], materials, ms[ii]) );
		gameObject.AddComponent(typeof(BoxCollider));
	}
	private void SetGeometryData(string data) {
		string[] lines = data.Split("\n".ToCharArray());
		
		//int ii = 0;
		for(int i = 0; i < lines.Length; i++) {
			string l = lines[i];
			
			if(l.IndexOf("#") != -1) l = l.Substring(0, l.IndexOf("#"));  // remove comments
			// Get rid of whitespace (including double spaces) during trimming. See http://msdn.microsoft.com/en-us/library/tabh47cf.aspx
			string[] p = l.Split(null as string[], StringSplitOptions.RemoveEmptyEntries);
			/*string bb = "" + ii + " l: " + l + " p[" + p.Length + "]:";
			for (int pi = 0; pi < p.Length; pi++) bb += " " + p[pi];
			Debug.Log(bb);
			ii++;*/
			if (p.Length < 1) continue;
			
			switch(p[0]) {
				case O:
					buffer.PushObject(p[1]);
					break;
				case G:
					buffer.PushGroup(p[1]);
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
					if (p.Length == 5) { // 'f' and four v/t/n groups as a polygon
						string[] adjustedP = new string[7]; //make two triangles
						adjustedP[0] = p[0]; // not used, just being consistent.
						adjustedP[1] = p[1];
						adjustedP[2] = p[2];
						adjustedP[3] = p[3];
						adjustedP[4] = p[3]; // keep the same handedness!
						adjustedP[5] = p[4];
						adjustedP[6] = p[1];
						p = adjustedP;
					}			
					for(int j = 1; j < p.Length; j++) {
						string[] c = p[j].Split("/".ToCharArray());  // do not remove empties!
						
						/*string bb2 = "" + ii + " c[" + c.Length + "]:";
						for (int pi2 = 0; pi2 < c.Length; pi2++) bb2 += " " + c[pi2];
						Debug.Log(bb2 + ".");*/

						FaceIndices fi = new FaceIndices();
						fi.vi = ObjUtil.ci(c[0])-1;	
						if ((c.Length > 1) && (c[1] != "")) fi.vu = ObjUtil.ci(c[1])-1;
						if ((c.Length > 2) && (c[2] != "")) fi.vn = ObjUtil.ci(c[2])-1;
						buffer.PushFace(fi);
					}
					break;
				case MTL:
					mtllib = p[1];
					break;
				case UML:
					buffer.PushMaterialName(p[1]);
					break;
			}
		}
		
		buffer.Trace();
	}
		
	private bool hasMaterials {
		get {
			return mtllib != null;
		}
	}
}