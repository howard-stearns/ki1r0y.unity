using UnityEngine;
using System.Collections;
using System.Collections.Generic;

// Manages asynchronous loading of resources.
// Because the operations are IEnumerator coroutines (i.e., use yield statements), this must be an instance of MonoBehavior.
// (We attach one instance to the scene.)

public class ResourceLoader : MonoBehaviour {
	public static ResourceLoader instance;
	void Start () { 
		if (instance != null) Debug.LogError("Private loaders do not currently default references from the first instance."); 
		else instance = this;
	}
	
	private const int DEBUG = 5;
	private const int TRACE = 6;
	public int logging = 0;
	private void Log(int level, string activity, string msg) { 
		if (logging >= level) Debug.Log("Loader: " + activity + " " + msg);
	}
	
	// Optimization: WWW in Unity editor is certainly not caching, despite Cache-Control/Expires.
	// See if the browser plugin and standalone is as bad.
	// See http://unity3d.com/webplayer_setup/setup-3.x/
		
	// Optimization? Should we have a priority queue of resources to load?
	// IWBNI playing audio/video came first, then object definitions, visible meshes, visible textures, non-visible meshes, non-visible textures, and non-playing audio/video.
	
	// Asynchronously loads basepath+name into material, and sets the texture's name as well.
	public IEnumerator FetchTexture(string basepath, string name, Material material) {
		string path = basepath + name;
		Log(TRACE, "fetch", path);
		WWW loader = new WWW(path);
		yield return loader;
		Log(DEBUG, "received", path);
		material.mainTexture = loader.texture;
   		material.mainTexture.name = name;
	}
	
	// Optimization? Keep dictionaries of fetched textures so that we don't repeatedly get the same thing?
	// private Dictionary<string, Texture> textures = new Dictionary<string, Texture>();
	
	// Blocking (synchronous) parse of .mtllib data into a dictionary of name->Material.
	public Dictionary<string, Material> ParseInto(string basepath, string libtext, Dictionary<string, Material> materials) {
		//Dictionary<string, Material> materials = new Dictionary<string, Material>();
	
		if(libtext != null) {
			SetMaterialData(libtext);
			foreach(MaterialData md in materialData) {
				materials.Add(md.name, GetMaterial(basepath, md));
			}
		} else {
			materials.Add("default", new Material(Shader.Find("VertexLit")));
		}
		return materials;
	}
	
	// Asynchronously set go's sharedMaterials to the materials that correspond to the given array of names, from the given dictionary.
	public IEnumerator FetchMaterials(string[] names, Dictionary<string, Material> materials, GameObject go) {
		Material[] mats = new Material[names.Length];
		yield return new WaitForFixedUpdate();
		for (int ii = 0; ii < names.Length; ii++) {
			mats[ii] = materials[names[ii]];  // FIXME: if it isn't in the dictionary, go find it.
		}
		go.renderer.materials = mats; // FIXME: go through Obj.sharedMaterials();
	}
	
	/* ############## MATERIALS Internal 
	 * When processing library data, there could in principle be forward references to other data (although I don't think that happens in mtllib format).
	 * So we do everything in two passes:
	 * 1. Parse everything fully into a List of private class elements.
	 * 2. Create a Material for each and add it to the dictionary.
	 * It is during this second pass that we start fetching textures into the Materials. */
	private const string NML = "newmtl";
	private const string NS = "Ns"; // Shininess
	private const string KA = "Ka"; // Ambient component (not supported)
	private const string KD = "Kd"; // Diffuse component
	private const string KS = "Ks"; // Specular component
	private const string D = "d"; 	// Transparency (not supported)
	private const string TR = "Tr";	// Same as 'd'
	private const string ILLUM = "illum"; // Illumination model. 1 - diffuse, 2 - specular
	private const string MAP_KD = "map_Kd"; // Diffuse texture (other textures are not supported)
	private List<MaterialData> materialData;
	private class MaterialData {
		public string name;
		public Color ambient;
   		public Color diffuse;
   		public Color specular;
   		public float shininess;
   		public float alpha;
   		public int illumType;
   		public string diffuseTexPath;
	}
	private Color gc(string[] p) {
		return new Color( ObjUtil.cf(p[1]), ObjUtil.cf(p[2]), ObjUtil.cf(p[3]) );
	}
	private void SetMaterialData(string data) {
		string[] lines = data.Split("\n".ToCharArray());
		
		materialData = new List<MaterialData>();
		MaterialData current = new MaterialData();
		
		for(int i = 0; i < lines.Length; i++) {
			string l = lines[i];
			
			if(l.IndexOf("#") != -1) l = l.Substring(0, l.IndexOf("#"));
			string[] p = l.Split(" ".ToCharArray());
			
			switch(p[0]) {
				case NML:
					current = new MaterialData();
					current.name = p[1].Trim();
					materialData.Add(current);
					break;
				case KA:
					current.ambient = gc(p);
					break;
				case KD:
					current.diffuse = gc(p);
					break;
				case KS:
					current.specular = gc(p);
					break;
				case NS:
					current.shininess = ObjUtil.cf(p[1]) / 1000;
					break;
				case D:
				case TR:
					current.alpha = ObjUtil.cf(p[1]);
					break;
				case MAP_KD:
					current.diffuseTexPath = p[1].Trim();
					break;
				case ILLUM:
					current.illumType = ObjUtil.ci(p[1]);
					break;
					
			}
		}	
	}
	private Material GetMaterial(string basepath, MaterialData md) {
		Material m;
		if(md.illumType == 2) {
			m =  new Material(Shader.Find("Specular"));
			m.SetColor("_SpecColor", md.specular);
			m.SetFloat("_Shininess", md.shininess);
		} else {
			m =  new Material(Shader.Find("Diffuse"));
		}

		m.SetColor("_Color", md.diffuse);
		
		StartCoroutine( FetchTexture(basepath, md.diffuseTexPath, m) );
		
		return m;
	}
}