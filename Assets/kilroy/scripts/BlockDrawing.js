 // The six faces of the block. Each should have the PictureDrawing script attached.
public var front:Transform;
public var left:Transform;
public var right:Transform;
public var top:Transform;
public var back:Transform;
public var bottom:Transform;

public function sharedMaterials():Material[] { 
	var m = new Material[6];
	m[0] = front.renderer.sharedMaterial;
	m[1] = left.renderer.sharedMaterial;
	m[2] = right.renderer.sharedMaterial;
	m[3] = top.renderer.sharedMaterial;
	m[4] = back.renderer.sharedMaterial;
	m[5] = bottom.renderer.sharedMaterial;
	return m;
}
// Assign new sharedMaterials and answer the new value.
public function sharedMaterials(mats:Material[]):Material[] {
	front.renderer.sharedMaterial = mats[0];
	left.renderer.sharedMaterial = mats[1];
	right.renderer.sharedMaterial = mats[2];
	top.renderer.sharedMaterial = mats[3];
	back.renderer.sharedMaterial = mats[4];
	bottom.renderer.sharedMaterial = mats[5];
	return mats;
}

// Wrap the given picture around the appropriate face.
// (We just have it try to wrap each face, but only one of them will be oriented in a way that "takes".)
function Wrap(picture:GameObject) {
	Application.ExternalCall('clearOnce', 'wrap');
	if (front.gameObject.GetComponent.<PictureDrawing>().Wrap(picture) 
	|| left.gameObject.GetComponent.<PictureDrawing>().Wrap(picture) 
	|| right.gameObject.GetComponent.<PictureDrawing>().Wrap(picture) 
	|| top.gameObject.GetComponent.<PictureDrawing>().Wrap(picture) 
	|| back.gameObject.GetComponent.<PictureDrawing>().Wrap(picture)
	|| bottom.gameObject.GetComponent.<PictureDrawing>().Wrap(picture)) {
		gameObject.GetComponent.<Obj>().saveScene('wrap'); 
	} else {
		Application.ExternalCall('errorMessage', "Kilroy was unable to figure out where the texture should go. Try putting a corner or the center of the " 
			+ picture.GetComponent.<Obj>().nametag + " onto the " + gameObject.GetComponent.<Obj>().nametag + ".");
	}
}
function NotWrapping(picture:GameObject) {
	var pictureObj = picture.GetComponent.<Obj>();
	if (pictureObj.kind != 'Plane') { return; } // for now...
	var thisObj = gameObject.GetComponent.<Obj>();
	Application.ExternalCall('sayOnce', 
		"When you have clicked to a picture, you can click the picture again to wrap it around the background surface. (For example, right now you can tile \""
		 + thisObj.nametag + "\" with the image from \"" + pictureObj.nametag + "\" by clicking again.)",
		'wrap');
}