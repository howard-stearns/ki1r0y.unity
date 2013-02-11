 // The six faces of the block. Each should have the PictureDrawing script attached.
public var front:Transform;
public var left:Transform;
public var right:Transform;
public var top:Transform;
public var back:Transform;
public var bottom:Transform;

// Distribute each of our six sharedMaterials to one of the faces.
// Used whenever our (block) sharedMaterials is changed.
// This allows, e.g., highlighting to just change the Obj materials, and have it affect the faces.
function NewMaterials() {
	var shared = renderer.sharedMaterials;
	front.renderer.sharedMaterial = shared[0]; 
	left.renderer.sharedMaterial = shared[1]; 
	right.renderer.sharedMaterial = shared[2];
	top.renderer.sharedMaterial = shared[3];
	back.renderer.sharedMaterial = shared[4];   
	bottom.renderer.sharedMaterial = shared[5]; 
}

function Awake() {
	NewMaterials();
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