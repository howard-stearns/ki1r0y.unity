/* Draws a texture onto a plane.
   Will eventually also handle drawing grafitti and text.
   This is meant to be on a Unity Plane object, whose mesh has some odd properities:
   	  It lies in the local x, z plane (with normal pointing up along positive y).
   	  The width and depth are 10 units across, so the localScale is typically 0.1.
   */

// The picture argument must already be positioned and sized as desired.
// This function projects the picture mainTexture along picture's "down" axis onto us,
// and then tiles as necessary to fill us in. (I.e., it keeps the position and size of the 
// projected picture.)
// FIXME: All corners of the picture must project to lie within our object (i.e., not hang over the edge).
// FIXME: The picture is assumed to have the same rotation (around y) as our object.
function Wrap(picture:GameObject) {
	var obj = gameObject;
	var initialColliderState = collider.enabled;
	var success = false;
	collider.enabled = true;
	
	// The scale is the number of times that picture will repeat in u and v as it is wrapped around obj.
	// To keep picture unchanged: ("size obj u" / "size picture u", "size obj v" / "size picture v")
	// where "size" means any comparable coordinate (e.g., not affected by differences in scale).
	// We'd like this to work with arbitrary mesh objs, but we at least know that picture is is a plane,
	// so let's use its coordinate system.
	// FUCK
	
	var bounds = picture.GetComponent(MeshFilter).mesh.bounds;
	Debug.Log('picture extents:' + bounds.size + ' obj:' + obj.GetComponent(MeshFilter).mesh.bounds.size);
	var p1 = picture.transform.TransformPoint(bounds.center + bounds.extents);
	var p2 = picture.transform.TransformPoint(bounds.center - bounds.extents);
	var pNNormal =  -picture.transform.up;
	Debug.Log(obj + ' p1:' + p1 + ' p2:' + p2);
	var hit1:RaycastHit; var hit2:RaycastHit;
	var h1 = obj.collider.Raycast(Ray(p1 - pNNormal, pNNormal), hit1, Mathf.Infinity);
	var h2 = obj.collider.Raycast(Ray(p2 - pNNormal, pNNormal), hit2, Mathf.Infinity);
	
	Debug.Log('p1 hit:' + hit1.point + ' uv:' + hit1.textureCoord);
	Debug.Log('p2 hit:' + hit2.point + ' uv:' + hit2.textureCoord);
		
	if (h1 && h2) {
		var minU = Mathf.Min(hit1.textureCoord.x, hit2.textureCoord.x);
		var minV = Mathf.Min(hit1.textureCoord.y, hit2.textureCoord.y);
		var maxU = Mathf.Max(hit1.textureCoord.x, hit2.textureCoord.x);
		var maxV = Mathf.Max(hit1.textureCoord.y, hit2.textureCoord.y);
		var scale = Vector2(1/(maxU - minU), 1/(maxV - minV));
		
		var offset = Vector2(minU, minV);
		// I'm not sure why the -1 is necessary: maybe because planes are left handed, but uv space is not.
		var offsetScaled = Vector2.Scale(-scale, offset); 
		Debug.Log(obj + ' min:' + Vector2(minU, minV) + ' max:' + Vector2(maxU, maxV));
		Debug.Log(obj + ' scale: ' + scale + ' offset:' + offset  + ' offsetScaled:' + offsetScaled);
		var targetMat:Material = obj.renderer.sharedMaterial;
		var parentMats:Material[] = obj.transform.parent.gameObject.renderer.sharedMaterials;
		var parentIndex = parentMats.IndexOf(parentMats, targetMat);
		targetMat = Material(targetMat);
		obj.renderer.sharedMaterial = targetMat;
		if (parentIndex >= 0) {
			parentMats[parentIndex] = targetMat;
			obj.transform.parent.gameObject.renderer.sharedMaterials = parentMats;
		}
		//Debug.Log('parent index: ' + parentIndex);
		targetMat.mainTexture = picture.renderer.material.mainTexture;
		targetMat.mainTextureScale = scale;
		targetMat.mainTextureOffset = offsetScaled;
		success = true;
		Debug.Log(obj + ' after scale: ' + scale + ' offset:' + offset + ' offsetScaled:' + offsetScaled); 
		Debug.Log(obj + ' texture scale: ' + obj.renderer.material.mainTextureScale + ' offset:' + obj.renderer.material.mainTextureOffset); 
	}
	collider.enabled = initialColliderState;
	return success;
}
