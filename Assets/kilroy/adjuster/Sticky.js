#pragma strict

// Provides the dragging behavior whereby the assembly is dragged around across all the other surfaces in the scene.
// option-drag (alt-drag) copies before dragging.
// option-click (alt-click) deletes
// click tries goto (and removes gizomo).
// It is expected that something is else is taking care of adding and removing the gizmo, and ensuring that nothing is
// highlighted before we start (as that will just get confusing during copy).

// For example, the assembly's mesh/collider must be on the IgnoreRaycast = 2 layer.
// The affordance that this script is attached to should be bit smaller than the assembly bounding box:
// 1. This allows there to be no confusion as to whether a strike near the corner is hitting us or a corner affordance, as the corners lie outside our (shrunken) box.
// 2. For cubes, when we project from affordance to mounting surface and back, we certainly won't miss an edge.

// TODO:
// reverse hit for skinny meshes: 	
// Push the selectedHit a bit towards the go center, so that we don't miss the edge on reversal.
//	var bounds = obj.bounds();
//	selectedHit += (bounds.center - selectedHit).normalized * 0.1;


class Sticky extends ColorInteractor {

// We are used with corner Adjust scripts, which brodcast 'updateAffordance' as they doDragging.
private var assemblyObj:Obj;
function updateAffordance() { //As other interactors resize assembly during movement, keep affordance at proper size.
	transform.localScale = assemblyObj.size() * 0.99;
}
function getGizmo() { return transform.parent; } // because that's what we set up.
function unparentGizmo(assy:Transform):Transform {
	var gizmo = getGizmo();
	if (gizmo.parent != assy) { Debug.LogError('gizmo ' + gizmo + ' is not a child of assembly ' + assy); } // sanity check
	gizmo.parent = null;
	return gizmo;
}
public static var ExistingGizmo:Transform; // Allow just one, globally.

private var originalAssemblyLayer = -1;
function updateAssembly(assy:Transform) {
	super.updateAssembly(assy); 
	if (!!assembly) {
		assemblyObj = assembly.gameObject.GetComponent.<Obj>();
		// We supply our own affordance that is just a bit smaller than the assembly bbox (so that we don't interfere with corner affordances).
		// So here we turn of the assembly's own collider, and re-enable it OnDestroy.
		if (originalAssemblyLayer == -1) { // Keep us idempotent
			originalAssemblyLayer = SetAssemblyLayer(assemblyObj.mesh, 2);  // Alternatively, we could disable collider...
			if (ExistingGizmo) { ExistingGizmo.parent = null; Destroy(ExistingGizmo.gameObject); }
			ExistingGizmo = getGizmo();
		}
	}
}
function Awake() {
	highlightColor = makeAlpha(Vector3(0.725, 0.761, 0.541)); // a shade of Facebook split-complement-1
	super.Awake();
}
function OnDestroy() {
	super.OnDestroy();
	if (!!assemblyObj) { 
		SetAssemblyLayer(assemblyObj.mesh, originalAssemblyLayer);
		// No need to set originalAssemblyLayer = -1, as this script instance will be destroyed.
	}
}

// The core activities of an Interactor: startDragging, resetCast/doDragging, stopDragging

public var pivotPrefab:Transform;
private var cursorOffsetToSurface:Vector3 = Vector3.zero;
private var lastDragPosition:Vector3;
private var firstDragPosition:Vector3; // For debouncing click vs drag;
private var rt1:Vector3;
private var fwd1:Vector3;

private var originalCopied:GameObject; // during a copy drag, this holds the original prototype of the copy.
private var draggedOriginalLayer = 0;  // of the whole assembly, not just the Obj.mesh
function startDragging(assembly:Transform, cameraRay:Ray, hit:RaycastHit):Laser {
	var go = assembly.gameObject; var obj = go.GetComponent.<Obj>();
	if (!!Input.GetAxis('Fire2')) {  //  alt/option key
		// Transfer gizmo to copy. Can't destroy it because it has state (including our own executing code).
		var gizmo = unparentGizmo(assembly);
		originalCopied = go;
		go = Instantiate(go);
		var goo = go.GetComponent.<Obj>();
		assembly = go.transform;  
		gizmo.parent = assembly;
		assembly.parent = originalCopied.transform.parent;
		assembly.BroadcastMessage('updateAssembly', assembly, SendMessageOptions.DontRequireReceiver);		
		// assemblyObj is side-effected by updateAssembly.
		assemblyObj.nametag = obj.nametag + '-copy';  // Hopefully temporary disambiguator during development.
		assemblyObj.sharedMaterials(obj.sharedMaterials());
		obj = assemblyObj;
		// If we're making a copy, the first dragging movement will always intersect the original object, and 
		// we'll instantly jump out from that surface as we try to mount the copy onto the original. Even if 
		// that's what the user ultimately wants, they still don't wan the jump. So, if we're working with a copy,
		// don't count the original until the user has finished that first copying drag.
		// I tried more complicated variants, such as ignoring the original only until we've 'cleared' away
		// from it, but couldn't make them work.
		draggedOriginalLayer = SetAssemblyLayer(originalCopied, 2);
	} else if (!!Input.GetAxis('Fire3')) { // cmd key
		Destroy(unparentGizmo(assembly).gameObject);
		var select = Avatar().gameObject.GetComponent(Select);
		if (!!select) { select.StartGizmo(assembly.gameObject); }
		return null;
	}
	var mountingDirection = obj ? assembly.TransformDirection(obj.localMounting) : -assembly.up;
	
	// Two Tests:
		
	// First we project the hit.point along the mountingDirection until we hit
	// a surface to slide along. No surface means we give up. 
	// FIXME: the reverse projection, below, will miss for skinny meshes that lie inside the affordance box's original hit.point.
	//        We should re-cast this to the objectCollider, then go towards the center a bit, before projecting down to a surface.
	var surfaceHit:RaycastHit; 
	var selectedHit = hit.point;  // Start with where the user clicked on the affordance.
	// Any object on any (non-ignored) layer will do. (No layer mask.)
	if (!Physics.Raycast(selectedHit, mountingDirection, surfaceHit)) { 
		// Should we also check for being too far away?  I think we might always want to let the object fall to floor (no matter what height),
		// but it does seem spooky to let an object slide to a wall across the room (e.g., if we're rotated to make the mountingDirection be sideways).
		// For now, no distance test.
		Debug.Log("Nothing under object to slide along.");
		// FIXME: create some sort of animation that shows that there's nothing under the mounting direction.
		Destroy(unparentGizmo(assembly).gameObject);
		return; 
	}

    // Now the reverse: the surfaceHit.point back to the assembly Obj's collider.
    var reverseHit:RaycastHit; 
    // But use a point "below" the hit.point (into surface, by depth of object) so we can catch embedded objects.
    var embeddedPoint = surfaceHit.point + (mountingDirection * obj.size().magnitude); 
    var reverseRay = Ray(embeddedPoint, -mountingDirection);
    var offset = Vector3.zero;
    var col = obj.objectCollider();
    var isMeshCollider = col.GetType().Name == 'MeshCollider';
    var oldConvex = isMeshCollider && (col as MeshCollider).convex;
    if (isMeshCollider) (col as MeshCollider).convex = true;  // so raycast can hit back of plane
 	if (col.Raycast(reverseRay, reverseHit, Mathf.Infinity)) { 
 		offset = surfaceHit.point - reverseHit.point;
       	/*Debug.Log('hit10:' + (10 * selectedHit) + '@' + hit.collider
       		+ ' surface10:' + (10 * surfaceHit.point) + '@' + surfaceHit.collider
       		+ ' reverse10:' + (10 * reverseHit.point) + '@' + reverseHit.collider
       		+ ' offset10:' + (10 * offset));*/
       	// FIXME: For any non-trivial offset, this should be animated.
		assembly.position += offset;
	} else { 
		Debug.LogError('** No reverse hit! ** hit:' + surfaceHit.point + ' mounting:' + mountingDirection + ' embedded:' + embeddedPoint);
	}
	if (isMeshCollider) (col as MeshCollider).convex = oldConvex;
	// Set drag state
	firstDragPosition = surfaceHit.point;
	lastDragPosition = firstDragPosition;
	rt1 = assembly.right; 
	fwd1 = assembly.forward;
	var contact:Vector3 = Camera.main.WorldToScreenPoint(lastDragPosition);
	contact.z = 0;
	cursorOffsetToSurface = contact - Input.mousePosition;
	// Setup up pivot.
	var pivot = Instantiate(pivotPrefab, lastDragPosition, assembly.rotation);  
	if (pivot.parent) Debug.LogError('*** FIXME Select:StartDragging Non-null pivot parent ' + pivot.parent);
	if (pivot.localScale != Vector3(1, 1, 1)) Debug.LogError('*** FIXME Select:StartDragging Non-unity pivot scale ' + pivot.localScale);
	pivot.parent = assembly.parent;  // No need to worry about scale screwing things up, because Obj assemblies always have unitary localScale.
	assembly.parent = pivot;
	// During drag, we have to get the whole assembly out of the way, so that we don't intersect with child objects and bounce around.
	// It's ok that originalAssemblyLayer might already be set for a copy -- the value would be the same anyway.
	originalAssemblyLayer = SetAssemblyLayer(assembly.gameObject, 2);
	gameObject.layer = 8; // Get our StrikeTarget out of the way. Don't change children, nor make StrikeTarget stop getting OnMouseEnter/Exit at all.
	// FIXME: animate laser movement from hit.point to surfaceHit.point.
	hit.point = surfaceHit.point; // so that Laser.StartInteraction() can do the right thing.
	return Avatar().Find('Shoulder').GetComponent.<Laser>();
}
var lastSurface:Collider;  // Keep track of this during dragging so that we can reparent at end.
function stopDragging(assembly:Transform) {	
	gameObject.layer = 0; // restore our StrikeTarget to hardcoded value.
	SetAssemblyLayer(assembly.gameObject, originalAssemblyLayer);
	var original = originalCopied;
	// pun: we're setting the WHOLE original obj, which will RESET it's Obj.mesh to behave normally, even if we've messed with it.
	if (!!original) SetAssemblyLayer(original, draggedOriginalLayer);
	originalCopied = null;
		
	var newParent = Obj.ColliderGameObject(lastSurface);
	var pivot = assembly.parent;
	assembly.parent = (newParent == null) ? pivot.parent : newParent.transform;
	// Destroy merely schedules destruction. We don't want pivot in the hierarchy (e.g., during saving).
	pivot.parent = null; 
	Destroy(pivot.gameObject);

	// Test for movement must be here rather than DoDragging, because we might not receive any DoDragging events.
	if (Vector3.Distance(firstDragPosition, lastDragPosition) > 0.2) {   // real movement, not just a click
		assembly.gameObject.GetComponent(Obj).saveScene(!!original ? 'copy' : 'move');
	} else if (!!original) {
		assembly.parent = null;
		Destroy(assembly.gameObject); // the copy. us.
		original.GetComponent.<Obj>().deleteObject(); // which does a save as well.
	} else {
		var avatar = Avatar();
		var goto = !avatar ? null : avatar.GetComponent(Goto);
		if (!!goto) {
			Destroy(unparentGizmo(assembly).gameObject);
			goto.Goto(assembly, true);
		}
	}
}
// We cast only against the Default layer (0). E.g., we don't want this to catch the gizmo on the HUD layer (8), nor assembly on IgnoreRaycast(2).
function resetCast(hit:RaycastHit[]):boolean { // overridable method to get new hit.point during drag
	return Physics.Raycast(Camera.main.ScreenPointToRay(Input.mousePosition + cursorOffsetToSurface), hit[0], Mathf.Infinity, (1<<0));
}
function doDragging(assembly:Transform, hit:RaycastHit) {
	var delta = hit.point - lastDragPosition;
	//Debug.Log('collider:' + hit.collider + ' last10:' + (10 * lastDragPosition) + ' hit10:' + (10 * hit.point) + ' delta10:' + (10 * delta));
	lastDragPosition = hit.point;
	lastSurface = hit.collider;
	var pivot = assembly.parent;
	pivot.Translate(delta, Space.World);
	var norm:Vector3 = hitNormal(hit);
	var alignedX:boolean = Mathf.Abs(Vector3.Dot(rt1, norm)) > 0.9;
	var fwd:Vector3 = alignedX ? fwd1 : Vector3.Cross(rt1, norm);
	pivot.rotation = Quaternion.LookRotation(fwd, norm);
}

// Utilities
public static function SetAssemblyLayer(go:GameObject, layer:int):int {  // set or restore IgnoreRaycast of an object with collider, returning old layer
	//Debug.Log('set ' + go + ' layer from ' + go.layer + ' to ' + layer);
	var old = go.layer;
	go.layer = layer;
	for (var child:Transform in go.transform) { 
		if (child.tag != 'FixedLayer') 
			SetAssemblyLayer(child.gameObject, layer);
	}
	return old;
}
function hitNormal(hit:RaycastHit) { // answer normal to the surface at hit.point, for meshes and primitives
	// Just in case, also make sure the collider also has a renderer material and texture 
   	var meshCollider = hit.collider as MeshCollider; 
   	if (meshCollider == null || meshCollider.sharedMesh == null) {
       	return hit.normal; 
	}
   	var mesh : Mesh = meshCollider.sharedMesh; 
   	var normals = mesh.normals; 
   	var triangles = mesh.triangles; 

   	// Extract local space normals of the triangle we hit 
   	var n0 = normals[triangles[hit.triangleIndex * 3 + 0]]; 
   	var n1 = normals[triangles[hit.triangleIndex * 3 + 1]];    
   	var n2 = normals[triangles[hit.triangleIndex * 3 + 2]];    
    
   	// interpolate using the barycentric coordinate of the hitpoint 
   	var baryCenter = hit.barycentricCoordinate; 

   	// Use barycentric coordinate to interpolate normal 
   	var interpolatedNormal = n0 * baryCenter.x + n1 * baryCenter.y + n2 * baryCenter.z; 
   	// normalize the interpolated normal 
   	interpolatedNormal =  interpolatedNormal.normalized; 
    
   	// Transform local space normals to world space 
   	var hitTransform : Transform = hit.collider.transform; 
   	interpolatedNormal = hitTransform.TransformDirection(interpolatedNormal); 

   	return interpolatedNormal;
}

// Management of the whole gizmo (e.g., six-axis corner affordances with Adjust scripts, too).
// Doesn't have to be here, but conveniently, there is exactly one Stick script in each such gizmo.


public static function AddAdjuster(assy:Transform, adjusterPrefab:Transform) { // Add adjusterPrefab as a child of assy.
	if (AnyMoving) { return; } // Don't mess up an existing drag.
	var gizmo = Instantiate(adjusterPrefab, assy.transform.position, assy.transform.rotation); 
	gizmo.Find('StrikeTarget').GetComponent(Sticky).initAdjuster(assy, gizmo);
}
function initAdjuster(assy:Transform, gizmo:Transform) {
	//Debug.Log('init  ' + transform + ' Gizmo:' + Gizmo + ' assy:' + assy);
	gizmo.name = 'Adjuster';   // I.e., not "Adjuster (clone)"
	gizmo.parent = assy;
	gizmo.gameObject.BroadcastMessage('updateAssembly', assy, SendMessageOptions.DontRequireReceiver);	
	gizmo.gameObject.BroadcastMessage('updateAffordance', null, SendMessageOptions.DontRequireReceiver); // get the size right	
	if (assy.gameObject.GetComponent.<Obj>().kind == 'Plane') {
		Destroy(gizmo.Find('X').gameObject);  // We can probably do this more efficiently.
		Destroy(gizmo.Find('Xneg').gameObject);
		Destroy(gizmo.Find('Z').gameObject);
		Destroy(gizmo.Find('Zneg').gameObject);
	}
}

}