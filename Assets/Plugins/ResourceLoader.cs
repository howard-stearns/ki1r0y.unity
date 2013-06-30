using UnityEngine;
using System.Collections;

// Manages asynchronous loading of resources.
// Because the operations are IEnumerator coroutines (i.e., use yield statements), this must be an instance of MonoBehavior.
// (We attach one instance to the scene.)

public class ResourceLoader : MonoBehaviour {
	public static ResourceLoader instance;
	void Start () { 
		if (instance != null) Debug.LogError("There can only be one instance."); 
		instance = this;
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
	
	// Optimization: Keep dictionaries of fetched results so that we don't repeatedly get the same thing.
	// private Dictionary<string, Texture> textures = new Dictionary<string, Texture>();
	
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
}