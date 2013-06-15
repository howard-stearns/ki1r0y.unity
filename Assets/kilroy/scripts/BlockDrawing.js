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
	front.gameObject.GetComponent(PictureDrawing).Wrap(picture);	
	left.gameObject.GetComponent(PictureDrawing).Wrap(picture);	
	right.gameObject.GetComponent(PictureDrawing).Wrap(picture);	
	top.gameObject.GetComponent(PictureDrawing).Wrap(picture);	
	back.gameObject.GetComponent(PictureDrawing).Wrap(picture);	
	bottom.gameObject.GetComponent(PictureDrawing).Wrap(picture);
}