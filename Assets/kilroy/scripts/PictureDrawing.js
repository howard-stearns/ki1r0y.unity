/* Draws a texture onto a plane.
   Will eventually also handle drawing grafitti and text.
   This is meant to be on a Unity Plane object, whose mesh has some odd properities:
   	  It lies in the local x, z plane (with normal pointing up along positive y).
   	  The width and depth are 10 units across, so the localScale is typically 0.1.
   */
function Log(msg:String) { 
	// Debug.Log('wrap: ' + msg);
}

// The picture argument must already be positioned and sized as desired.
// This function projects the picture mainTexture along picture's "down" axis onto us,
// and then tiles as necessary to fill us in. (I.e., it keeps the position and size of the 
// projected picture.)
// FIXME: All corners of the picture must project to lie within our object (i.e., not hang over the edge).
// FIXME: The picture is assumed to have the same rotation (around y) as our object.
	// The scale is the number of times that picture will repeat in u and v as it is wrapped around face.
	// To keep picture unchanged: ("size face u" / "size picture u", "size face v" / "size picture v")
	// where "size" means any comparable coordinate (e.g., not affected by differences in scale).
	// We'd like this to work with arbitrary mesh faces, but we at least know that picture is is a plane,
	// so let's use its coordinate system.
	// FUCK
function Wrap(picture:GameObject) {
	var face = gameObject;
	var success = false;
	var pictureObj = picture.GetComponent(Obj);
	var bounds = pictureObj.bounds();
	var p1 = (bounds.center + bounds.extents);
	var p2 = (bounds.center - bounds.extents);
	var pNNormal =  -picture.transform.up;
	Log(face + ' p1:' + p1 + ' p2:' + p2);
	var hit1:RaycastHit; var hit2:RaycastHit;
	var fCollider = face.collider; // 
	var h1 = fCollider.Raycast(Ray(p1 - pNNormal, pNNormal), hit1, Mathf.Infinity);
	var h2 = fCollider.Raycast(Ray(p2 - pNNormal, pNNormal), hit2, Mathf.Infinity);
	
	Log('p1 hit:' + hit1.point + ' uv:' + hit1.textureCoord);
	Log('p2 hit:' + hit2.point + ' uv:' + hit2.textureCoord);
		
	if (h1 && h2) {
		var minU = Mathf.Min(hit1.textureCoord.x, hit2.textureCoord.x);
		var minV = Mathf.Min(hit1.textureCoord.y, hit2.textureCoord.y);
		var maxU = Mathf.Max(hit1.textureCoord.x, hit2.textureCoord.x);
		var maxV = Mathf.Max(hit1.textureCoord.y, hit2.textureCoord.y);
		var scale = Vector2(1/(maxU - minU), 1/(maxV - minV));
		
		var offset = Vector2(minU, minV);
		// I'm not sure why the -1 is necessary: maybe because planes are left handed, but uv space is not.
		var offsetScaled = Vector2.Scale(-scale, offset); 
		Log(face + ' min:' + Vector2(minU, minV) + ' max:' + Vector2(maxU, maxV));
		Log(face + ' scale: ' + scale + ' offset:' + offset  + ' offsetScaled:' + offsetScaled);
		var obj = face.transform.parent.parent.gameObject.GetComponent(Obj);  // Warning: Demeter not happy about being dependent on Block->Cube->face structure.
		var parentMats:Material[] = obj.sharedMaterials();
		var targetMat:Material = face.renderer.sharedMaterial;
		var parentIndex = parentMats.IndexOf(parentMats, targetMat);
		targetMat = Material(targetMat);
		if (parentIndex >= 0) {
			targetMat.mainTexture = pictureObj.sharedMaterials()[0].mainTexture;
			targetMat.mainTextureScale = scale;
			targetMat.mainTextureOffset = offsetScaled;
			parentMats[parentIndex] = targetMat;
			obj.sharedMaterials(parentMats);
			success = true;
			Log(face + ' after scale: ' + scale + ' offset:' + offset + ' offsetScaled:' + offsetScaled); 
			Log(face + ' texture scale: ' + face.renderer.material.mainTextureScale + ' offset:' + face.renderer.material.mainTextureOffset); 
		} else Debug.LogError('Failed to find ' + targetMat + ' in sharedMaterials.');
	}
	return success;
}
