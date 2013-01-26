public var front:Transform;
public var left:Transform;

function copyMat(shared:Material, target:Transform):Material {
	// Make a copy of material, share that same instance with target, and return the copy.
	var mat = Material(shared);
	var mats = new Material[1];
	mats[0] = mat;
	target.renderer.sharedMaterials = mats;
	return mat;
}

function NewMaterials() {
	var shared = renderer.sharedMaterials;
	front.renderer.sharedMaterial = shared[0]; // = copyMat(shared[0], front);
	left.renderer.sharedMaterial = shared[1]; // = copyMat(shared[1], left);
	//renderer.sharedMaterials = shared;
}

function Awake() {
	NewMaterials();
}

function Wrap(picture:GameObject) {
	front.gameObject.GetComponent(PictureDrawing).Wrap(picture);	
	left.gameObject.GetComponent(PictureDrawing).Wrap(picture);	
}