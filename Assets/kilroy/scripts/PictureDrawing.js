/* Draws a texture onto a plane.
   Will eventually also handle drawing grafitti and text.
   This is meant to be on a Unity Plane object, whose mesh has some odd properities:
   	  It lies in the local x, z plane (with normal pointing up along positive y).
   	  The width and depth are 10 units across, so the localScale is typically 0.1.
   */
function Log(msg:String) { 
	Debug.Log('wrap: ' + msg);
}

/* 
Each point on the mesh has a u, v. This coordinate is mapped to a scaled/offset u', v' of the texture:
u' = u * scale.u + offset.u
v' = v * scale.v + offset.v
e.g.:
scale = 1, .5;  offset = .1, 0
mesh-space uv => texture-space
a = 0, 0      => 0*1 + .1, 0*.5 + 0 =  .1, 0
b = 0, 1      => 0*1 + .1, 1*.5 + 0 =  .1, .5
c = 1, 0      => 1*1 + .1, 0*.5 + 0 = 1.1, 0
d = 1, 1      => 1*1 + .1, 1*.5 + 0 = 1.1, .5
.1, .5    1.1, .5
+-------+ Texture is shifted 10% to the left. => 10% of the repeated texture appears on the right side.
|b     d| Upper edge of plane is mapped to 0.5 instead of 1, so you only see the lower half stretched over the plane.
|       |
|a     c|
+-------+ 
.1, 0    1.1, 0
                            texture uv
+------------------------------------------------------+  mesh-space uv => texture-space
|                                                      |  a = 0, 0      => .1, .1
|	 +---------------------------------------------+   |  b = 0, 1      => .1, .9
|	 | b                 mesh uv                 d |   |  c = 1, 0      => .9, .1
|	 |                                             |   |  d = 1, 1      => .9, .9
|	 |                                             |   |    u' = u * scale.u + offset.u
|	 |                                             |   | a) .1 = 0 * scale.u + offset.u  => offset.u=.1
|	 |                                             |   | c) .9 = 1 * scale.u + offset.u  => .9 = scale.u + .1 => scale.u=.8
|	 |                                             |   | Similarly for v using b and d.
|	 |                                             |   |
|	 |                                             |   |
|	 |                                             |   |
|	 |                                             |   |
|	 | a                                         c |   |
|	 +---------------------------------------------+   |
|                                                      |
+------------------------------------------------------+

                          mesh uv
	 +---------------------------------------------+  mesh-space uv => texture-space
	 |          .2, .9                  .8, .9     |  a = .2, .2    => 0, 0 
	 |          +-----------------------+          |  b = .2, .9    => 0, 1
	 |          | b     texture uv    d |          |  c = .8, .2    => 1, 0
	 |          |                       |          |  d = .8, .9    => 1, 1
	 |          |                       |          |    u' = u * scale.u + offset.u
	 |          |                       |          | a) 0 = .2 * scale.u + offset.u
	 |          |                       |          | c) 1 = .8 * scale.u + offset.u
	 |          | a                   c |          | => .2 * scale.u = .8 * scale.u - 1 => 1 = .6 * scale.u => scale.u=1.6667
	 |          +-----------------------+          | => 0 = .2 * 1.6667 + offset.u => offset.u = 0 -(.2*1.6667) = -0.3333
	 |          .2, .2                  .8, .2     | check: .2 * 1.6667 - 0.333 = 0
	 |                                             |   and: .8 * 1.6667 - 0.333 = 1 
	 +---------------------------------------------+


                        mesh uv
	 +---------------------------------------------+            
	 |                                             |
	 |          +----------------------------------|----+
	 |          |                                  |    |
	 |          |                                  |    |
	 |          |                                  |    |
	 |          |                                  |    |
	 |          |                                  |    |
	 |          |                                  |    |
	 |          |                                  |    |
	 |          |                                  |    |
	 |          |                                  |    |
	 +---------------------------------------------+    |
                |                                       |
	            +---------------------------------------+
                                texture uv

Drop all four texture uv corners onto mesh, and vice versa:
  t00, t01, t10, t11 =maybeFinding=> m1, m2, m3, m4
  m00, m01, m10, m11 =myabeFinding=> t1, t2, t3, t4
There will be at least two non-misses.
Find two such that u1!=u2, v1!=v2, u'1!=u'2, v'1!=v'2, keeping track of uv and u'v' for each retained pair.
Call these a and d. (We don't really care whether they are b & c, just diagonal.)
 a.u' = a.u * scale.u + offset.u
 d.u' = d.u * scale.u + offset.u

a.u' - (a.u * scale.u) = d.u' - (d.u * scale.u)
a.u' - d.u' = a.u * scale.u - d.u * scale.u = (a.u - d.u) * scale.u 
(a.u' - d.u') / (a.u - d.u) = scale.u

a.u' - (a.u * scale.u) = offset.u 

Similarly for v.
*/

// The picture argument must already be positioned and sized as desired.
// This function projects the picture mainTexture along picture's "down" axis onto us,
// and then tiles as necessary to fill us in. (I.e., it keeps the position and size of the 
// projected picture.)
// FIXME: The picture is assumed to have the same rotation (around y) as our object.
function Wrap(picture:GameObject) {
	var face = gameObject;
	var pictureObj = picture.GetComponent.<Obj>();
	var pNNormal =  -picture.transform.up;
	var fCollider = face.collider;
	var gotPoints = false;
	// We're picking points that, by construction, will be a and d, above, although we don't know until
	// we're done which is which.
	var hita:RaycastHit; var hitd:RaycastHit;
	// UV coordinates on Mesh and Texture (picture), for points a and d.
	var uvMa = Vector2.zero; var uvMd = Vector2.zero;
	var uvTa = Vector2.zero; var uvTd = Vector2.zero;
	
	var bounds = pictureObj.bounds();
	var p1 = (bounds.center - bounds.extents);
	var p2 = (bounds.center + bounds.extents);
	var m1 = fCollider.Raycast(Ray(p1 - pNNormal, pNNormal), hita, Mathf.Infinity);
	var m2 = fCollider.Raycast(Ray(p2 - pNNormal, pNNormal), hitd, Mathf.Infinity);	
	Log(face + ' p1:' + p1 + ' p2:' + p2);
	if (m1 && m2) {
		Log('m1 hit:' + hita.point + ' uv:' + hita.textureCoord);
		Log('m2 hit:' + hitd.point + ' uv:' + hitd.textureCoord);
		uvMa = hita.textureCoord; uvTa = Vector2(0, 0);
		uvMd = hitd.textureCoord; uvTd = Vector2(1, 1);
		gotPoints = true;
	} else {
		var faceBounds = collider.bounds;
		var vCollider = pictureObj.objectCollider();
		p1 = faceBounds.center - faceBounds.extents;
		p2 = faceBounds.center + faceBounds.extents;
		Log(face + ' face p1:' + p1 + ' p2:' + p2);
		uvMa = Vector2(0, 0); 
		uvMd = Vector2(1, 1); 
		
		// I'd like to replace the above with some generalization...
		//var mesh:Mesh = GetComponent(MeshFilter).sharedMesh;
		//Log(face + ' mesh:' + (mesh ? mesh : 'none'));
		
		var t1 = vCollider.Raycast(Ray(p1 - pNNormal, pNNormal), hita, Mathf.Infinity);
		var t2 = vCollider.Raycast(Ray(p2 - pNNormal, pNNormal), hitd, Mathf.Infinity);
		if (t1 && t2) {
			Log('t1 hit:' + hita.point + ' uv:' + hita.textureCoord);
			Log('t2 hit:' + hitd.point + ' uv:' + hitd.textureCoord);
			uvTa = hita.textureCoord;
			uvTd = hitd.textureCoord;
			gotPoints = true;
		}
	}
	
	if (gotPoints) {
		var scale = Vector2((uvTa.x - uvTd.x) / (uvMa.x - uvMd.x),
							(uvTa.y - uvTd.y) / (uvMa.y - uvMd.y)); 
		var offset = Vector2(uvTa.x - (uvMa.x * scale.x),
							 uvTa.y - (uvMa.y * scale.y));
		Log(face + ' scale: ' + scale + ' offset:' + offset);		

		var obj = face.transform.parent.parent.gameObject.GetComponent.<Obj>();  // Warning: Demeter not happy about being dependent on Block->Cube->face structure.
		var parentMats:Material[] = obj.sharedMaterials();
		var targetMat:Material = face.renderer.sharedMaterial;
		var parentIndex = parentMats.IndexOf(parentMats, targetMat);
		if (parentIndex >= 0) {
			targetMat = Material(targetMat);
			var txt = pictureObj.sharedMaterials()[0].mainTexture;
			//Log('txt aniso:' + txt.anisoLevel + ' filterMode:' + txt.filterMode + ' bias:' + txt.mipMapBias + ' wrapMode:' + txt.wrapMode + ' format:' + txt.format + ' mipmapCount:' + txt.mipmapCount + ' ' + txt.width + ' x ' +  txt.height);
			txt.wrapMode = TextureWrapMode.Repeat; // Set at import, but not preserved by our saving.
			targetMat.mainTexture = txt;
			targetMat.mainTextureScale = scale;
			targetMat.mainTextureOffset = offset;
			parentMats[parentIndex] = targetMat;
			obj.sharedMaterials(parentMats);
			obj.materialData = null; // clear cached serialization data
			return true;
			//Log(face + ' after scale: ' + scale + ' offsetUnscaled:' + offsetUnscaled + ' offset:' + offset); 
			//Log(face + ' texture scale: ' + face.renderer.material.mainTextureScale + ' offset:' + face.renderer.material.mainTextureOffset); 
		} else Application.ExternalCall('errorMessage', "Failed to find " + targetMat + " in sharedMaterials.");
	}
	//Application.ExternalCall('errorMessage', 'Texture wrapping is currently limited to when all four corners of the picture fit squarely on the target.');
	return false;
}