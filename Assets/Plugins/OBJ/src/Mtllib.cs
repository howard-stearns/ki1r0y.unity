using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class Mtllib {
	
	public string[] Load(string mtllibContent) { // Answers an array of texturePathnameOrNull
		SetMaterialData(mtllibContent);
		int n = materialData.Count;
		string [] filenames = new string[n];
		for (int i = 0; i < n; i++) { filenames[i] = materialData[i].diffuseTexPath; }
		return filenames;
	}
	public void SetTexture(int i, Texture2D texture) {
		materialData[i].diffuseTex = texture;
	}
	//public Material Build(Material mat) {
	//}
	public Dictionary<string, Material> Build(bool hasMaterials) {
		Dictionary<string, Material> materials = new Dictionary<string, Material>();
	
		if(hasMaterials) {
			foreach(MaterialData md in materialData) {
				materials.Add(md.name, GetMaterial(md));
			}
		} else {
			materials.Add("default", new Material(Shader.Find("VertexLit")));
		}
		return materials;
	}
			
	/* MTL file tags */
	private const string NML = "newmtl";
	private const string NS = "Ns"; // Shininess
	private const string KA = "Ka"; // Ambient component (not supported)
	private const string KD = "Kd"; // Diffuse component
	private const string KS = "Ks"; // Specular component
	private const string D = "d"; 	// Transparency (not supported)
	private const string TR = "Tr";	// Same as 'd'
	private const string ILLUM = "illum"; // Illumination model. 1 - diffuse, 2 - specular
	private const string MAP_KD = "map_Kd"; // Diffuse texture (other textures are not supported)

	/* ############## MATERIALS */
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
   		public Texture2D diffuseTex;
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
			
	private Material GetMaterial(MaterialData md) {
		Material m;
		if(md.illumType == 2) {
			m =  new Material(Shader.Find("Specular"));
			m.shader = Shader.Find("Specular");
			m.SetColor("_SpecColor", md.specular);
			m.SetFloat("_Shininess", md.shininess);
		} else {
			m =  new Material(Shader.Find("Diffuse"));
			m.shader = Shader.Find("Diffuse");
		}

		m.SetColor("_Color", md.diffuse);
		
		if(md.diffuseTex != null) m.SetTexture("_MainTex", md.diffuseTex);
		
		return m;
	}
	
	private Color gc(string[] p) {
		return new Color( ObjUtil.cf(p[1]), ObjUtil.cf(p[2]), ObjUtil.cf(p[3]) );
	}
}
