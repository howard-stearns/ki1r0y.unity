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
	Debug.Log('obj:' + obj + ' picture:' + picture);
	
	var pm = picture.GetComponent(MeshFilter).mesh;
	var p1 = picture.transform.TransformPoint(pm.bounds.center - pm.bounds.extents);
	var p2 = picture.transform.TransformPoint(pm.bounds.center + pm.bounds.extents);
	var pNNormal =  -picture.transform.up;
	Debug.Log(obj.ToString() + ' p1:' + p1 + ' p2:' + p2);
	var hit1:RaycastHit; var hit2:RaycastHit;
	if (obj.collider.Raycast(Ray(p1 - pNNormal, pNNormal), hit1, Mathf.Infinity)
		&& obj.collider.Raycast(Ray(p2 - pNNormal, pNNormal), hit2, Mathf.Infinity)) {
		
		Debug.Log(obj.ToString() + ' p1 hit:' + hit1.point + ' normal:' + hit1.normal + ' uv:' + hit1.textureCoord);
		Debug.Log('p2 hit:' + hit2.point + ' normal:' + hit2.normal + ' uv:' + hit2.textureCoord);

		var minU = Mathf.Min(hit1.textureCoord.x, hit2.textureCoord.x);
		var minV = Mathf.Min(hit1.textureCoord.y, hit2.textureCoord.y);
		var maxU = Mathf.Max(hit1.textureCoord.x, hit2.textureCoord.x);
		var maxV = Mathf.Max(hit1.textureCoord.y, hit2.textureCoord.y);
		var scale = Vector2(1/(maxU - minU), 1/(maxV - minV));
		var offset = Vector2(minU, minV);
		// I'm not sure why the -1 is necessary: maybe because planes are left handed, but uv space is not.
		var offsetScaled = Vector2(scale.x * offset.x * -1, scale.y * offset.y * -1);
		Debug.Log(obj.ToString() + ' scale: ' + scale + ' offset:' + offset 
			+ ' scale.x:' + scale.x + ' scale.y:' + scale.y 
			+ ' offset.x:' + offset.x + ' offset.y' + offset.y
			+ ' offsetScaled:' + offsetScaled);
		var targetMat:Material = obj.renderer.sharedMaterial;
		var parentMats:Material[] = obj.transform.parent.gameObject.renderer.sharedMaterials;
		var parentIndex = parentMats.IndexOf(parentMats, targetMat);
		targetMat = Material(targetMat);
		obj.renderer.sharedMaterial = targetMat;
		if (parentIndex >= 0) {
			parentMats[parentIndex] = targetMat;
			obj.transform.parent.gameObject.renderer.sharedMaterials = parentMats;
		}
		Debug.Log('parent index: ' + parentIndex);
		targetMat.mainTexture = picture.renderer.material.mainTexture;
		targetMat.mainTextureScale = scale;
		targetMat.mainTextureOffset = offsetScaled;
		success = true;
		Debug.Log(obj.ToString() + ' after scale: ' + scale + ' offset:' + offset + ' offsetScaled:' + offsetScaled); 
		Debug.Log(obj.ToString() + ' textur scale: ' + obj.renderer.material.mainTextureScale + ' offset:' + obj.renderer.material.mainTextureOffset); 
	}
	collider.enabled = initialColliderState;
	return success;
}
