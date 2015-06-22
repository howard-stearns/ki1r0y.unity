/* Draws a texture onto a plane.
   Will eventually also handle drawing grafitti and text.
   This is meant to be on a Unity Plane object, whose mesh has some odd properities:
   	  It lies in the local x, z plane (with normal pointing up along positive y).
   	  The width and depth are 10 units across, so the localScale is typically 0.1.
   */
function Log(msg:String) { 
	Debug.LogWarning('wrap: ' + msg);
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
function mid(v1, v2) { return (v1 + v2) / 2.0; }

// The picture argument must already be positioned and sized as desired.
// This function projects the picture mainTexture along picture's "down" axis onto us,
// and then tiles as necessary to fill us in. (I.e., it keeps the position and size of the 
// projected picture.)
function Wrap(picture:GameObject) {
	var face = gameObject;
	var pictureObj = picture.GetComponent.<Obj>();
	var pNNormal =  -picture.transform.up;
	var fCollider = face.GetComponent.<Collider>();
	var faceEnabled = fCollider.enabled;
	fCollider.enabled = true;
	var gotPoints = false;
	// We're picking points that, by construction, will be a and d, above, although we don't know until
	// we're done which is which.
	var hita:RaycastHit; var hitd:RaycastHit;
	// UV coordinates on Mesh and Texture (picture), for points a and d.
	var uvMa = Vector2.zero; var uvMd = Vector2.zero;
	var uvTa = Vector2.zero; var uvTd = Vector2.zero;
	
	var vertices = new Vector3[4]; var uv = new Vector2[4];
	// We need world space positions of the picture corners for dropping, keeping careful track of order.
	// Fortunately, pictures are created by us so we know exactly which mesh vertex is which.
	var pictureMesh = pictureObj.mesh.GetComponent.<MeshFilter>().sharedMesh;
	var index = 0; var iteration = 0;
	for (var ii:int in [0, 10, 120, 110]) {
		vertices[index] = pictureObj.mesh.transform.TransformPoint(pictureMesh.vertices[ii]);
		uv[index] = pictureMesh.uv[ii];
		index++;
	}
	//Log('uv ' + uv[0] + ' ' + uv[1] + ' ' + uv[2] + ' ' + uv[3]);
	var txt3dCenter = mid(vertices[0], vertices[2]);
	uvTa = mid(uv[0], uv[2]);
	//Log('picture center ' + picture.transform.position + ' ' + txt3dCenter);
	// If this face doesn't have a hit, we want to bail out fast rather than trying like heck to find one.
	// Corners are not good choices, for this quick test, because they might be right on the edge giving a false negative or false positive.
	// Checking a "center" point is a good choice, because they're in the middle and ultimately we'll want two diagonal points 
	// (each point having a different texture u and different texture v), so having a "center" and a single "corner" works out.
	var rayOrigin = txt3dCenter - pNNormal;
	//Log('collider=' + fCollider + ' picture center ray position=' + rayOrigin + ' direction (picture normal=' + pNNormal);
	if (fCollider.Raycast(Ray(rayOrigin, pNNormal), hita, Mathf.Infinity)) { // if the initial center is good, use that for point a.
		uvMa = hita.textureCoord;
		//Log('got center ' + uvMa + ' ' + uvTa);
	} else { // Try up to 4 candidate new "centers"
		for (index = 0; index < 4 && !gotPoints; index++) {
			var candidate = mid(txt3dCenter, vertices[index]);
			//Log('check candidate corner ' + index + ' ' + candidate + ' from ' + txt3dCenter + ' ' + vertices[index]);
			if (fCollider.Raycast(Ray(candidate - pNNormal, pNNormal), hita, Mathf.Infinity)) {
				uvMa = hita.textureCoord; uvTa = mid(uvTa, uv[index]);
				txt3dCenter = candidate; // for use in moving corners towards this "center", below.
				gotPoints = true;
			}
		}
		if (!gotPoints) { fCollider.enabled = faceEnabled; return false; } // after five interior misses, it's not worth pecking about
		gotPoints = false; // reset for further activity below
	}
	// Now find a diagonal by checking each "corner".
	// Outer iteration starts with the outer corners. If we fail, move the corners in by half. Repeat up to 4 outer iterations.
	//Log('corner is ' + txt3dCenter);
	var selectedIndex = 0; // For angle computation, below.
	for (iteration = 0; iteration < 4 && !gotPoints; iteration++) {
		for (index = 0; index < 4 && !gotPoints; index++) {  // try each corner in turn...
			//Log('corner candidate ' + iteration + ' ' + index + ' ' + vertices[index]);
			if (fCollider.Raycast(Ray(vertices[index] - pNNormal, pNNormal), hitd, Mathf.Infinity)) {             // ... until we find a drop.
				uvMd = hitd.textureCoord; uvTd = uv[index];
				selectedIndex = index;
				gotPoints = true;
			}
		}
		// We failed to drop a corner onto the mesh. Since we did drop the center, the corners must be too far out.
		for (index = 0; index < 4 && !gotPoints; index++) { // Move each corner halfwary towards the center (which worked).
			vertices[index] = mid(vertices[index], txt3dCenter);
			uv[index] = mid(uv[index], uvTa);
		}
	}
	
	if (gotPoints) {
		var obj = face.transform.parent.parent.gameObject.GetComponent.<Obj>();  // Warning: Demeter not happy about being dependent on Block->Cube->face structure.
		//Log(face + ' index ' + selectedIndex + ' picture ' + uvTa + ' ' + uvTd + ' mesh ' + uvMa + ' ' + uvMd);
		// Find out if we're rotated: First grab an adjacent corner and work it towards the corner we used until it hits.
		var adjacentIndex = (selectedIndex + 1)  % 4;
		var adjacentCorner = vertices[adjacentIndex]; var adjacentUv = uv[adjacentIndex];
		for (iteration = 0; iteration < 10; iteration++) {
			if (fCollider.Raycast(Ray(adjacentCorner - pNNormal, pNNormal), hita, Mathf.Infinity)) { break; }
			adjacentCorner = mid(adjacentCorner, vertices[selectedIndex]);
		}
		var rotation = Vector2.Angle(adjacentUv - uvTd, hita.textureCoord - uvMd);
		if (rotation) { 
			Application.ExternalCall('advice', "Kilroy cannot yet handle rotated textures. Of course, you can rotate " 
				+ obj.nametag + " by alt-dragging a corner.");
		}
		var scale = Vector2((uvTa.x - uvTd.x) / (uvMa.x - uvMd.x),
							(uvTa.y - uvTd.y) / (uvMa.y - uvMd.y)); 
		var offset = Vector2(uvTa.x - (uvMa.x * scale.x),
							 uvTa.y - (uvMa.y * scale.y));
		//Log(face + ' scale: ' + scale + ' offset:' + offset + ' rotation:' + rotation);		

		var parentMats:Material[] = obj.sharedMaterials();
		var targetMat:Material = face.GetComponent.<Renderer>().sharedMaterial;
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
			fCollider.enabled = faceEnabled;
			return true;
		} else Application.ExternalCall('errorMessage', "Failed to find " + targetMat + " in sharedMaterials.");
	}
	fCollider.enabled = faceEnabled;
	return false;
}