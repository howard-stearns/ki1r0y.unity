#pragma strict

// Provides the dragging behavior whereby the assembly is dragged around across all the other surfaces in the scene.
//
// This is NOT a subclass of Directional because all Directional subclasses work by interpreting drag along a 
// single plane that does not change during the drag. However, terminology and requirements are as specified in Directional.
// For example, the assembly's mesh/collider must be on the IgnoreRaycast = 2 layer.
// The affordance that this script is attached to should be bit smaller than the assembly bounding box:
// 1. This allows there to be no confusion as to whether a strike near the corner is hitting us or a corner affordance, as the corners lie outside our (shrunken) box.
// 2. For cubes, when we project from affordance to mounting surface and back, we certainly won't miss an edge.

function hitNormal(hit:RaycastHit) {
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

public var pivotPrefab:Transform;
private var cursorOffsetToSurface:Vector3 = Vector3.zero;
private var lastDragPosition:Vector3;
private var firstDragPosition:Vector3; // For debouncing click vs drag;
private var rt1:Vector3;
private var fwd1:Vector3;

function between(verticalObject:GameObject, p1:Vector3, p2:Vector3, width:float) {
	var offsetToCenter:Vector3 = (p1 - p2) / 2.0;
	verticalObject.transform.position = p1 - offsetToCenter;
	verticalObject.transform.up = p2 - p1;
	verticalObject.transform.localScale = Vector3(width, offsetToCenter.magnitude, width);
}
public var laserPrefab:Transform;
public var shoulder:Transform;
private var laser:GameObject;

function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit):Collider {
	var go = assembly.gameObject;
	// UnHighlight(); // as it will just confuse things, particularly on copy.
	/*if (copy) {
		originalCopied = go;
		go = Instantiate(go);
		// If we're making a copy, the first dragging movement will always intersect the original object, and 
		// we'll instantly jump out from that surface as we try to mount the copy onto the original. Even if 
		// that's what the user ultimately wants, they still don't wan the jump. So, if we're working with a copy,
		// don't count the original until the user has finished that first copying drag.
		// I tried more complicated variants, such as ignoring the original only until we've 'cleared' away
		// from it, but couldn't make them work.
		SetAssemblyLayer(originalCopied, 2);
		// Hopefully temporary disambiguator during development.
		var goo = go.GetComponent.<Obj>();
		goo.nametag = goo.nametag + '-copy';
		goo.sharedMaterials(goo.sharedMaterials());
	}*/
	var obj = go.GetComponent(Obj);
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
		Debug.Log("Nothing under object to slide along.");
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
	
	laser = Instantiate(laserPrefab.gameObject);
	between(laser, shoulder.position + Vector3(0.5, -0.5, 0.5), surfaceHit.point, 0.05);
	Debug.Log(laser + ' betweeen ' + shoulder.position + ' and ' + surfaceHit.point);
	laser.transform.parent = pivot.parent;
	
	return transform.collider;
}
function stopDragging(assembly:Transform):Obj {
	var go = assembly.gameObject;
	var obj = go.GetComponent(Obj);
	
	var pivot = assembly.parent;
	assembly.parent = pivot.parent;	
	// Destroy merely schedules destruction. We don't want pivot in the hierarchy (e.g., during saving).
	pivot.parent = null; 
	Destroy(pivot.gameObject);

	return obj;
}
function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	var delta = hit.point - lastDragPosition;
	//Debug.Log('last10:' + (10 * lastDragPosition) + ' hit10:' + (10 * hit.point));
	lastDragPosition = hit.point;
	var pivot:Transform = assembly.parent;
	pivot.Translate(delta, Space.World);
	var norm:Vector3 = hitNormal(hit);
	var alignedX:boolean = Mathf.Abs(Vector3.Dot(rt1, norm)) > 0.9;
	var fwd:Vector3 = alignedX ? fwd1 : Vector3.Cross(rt1, norm);
	pivot.rotation = Quaternion.LookRotation(fwd, norm);
	
	between(laser, shoulder.position + Vector3(0.5, -0.5, 0.5), hit.point, 0.1);
}

private var isActive = false;
function OnMouseEnter () {
	if (assembly.parent && (assembly.parent.name == 'GridTarget')) return; // Already dragging by someone (not necessarilly this axis).
	isActive = true;
}
function OnMouseExit () {
	isActive = false;
}

private var isMoving = false; // In the processing of being dragged around.
public var assembly:Transform;  // The object to be transformed.
private var affordanceCollider:Collider;
private var dragCollider:Collider; 
function startDragging1(cameraRay:Ray, hit:RaycastHit) {
	isMoving = true;
	dragCollider = startDragging(assembly, null, null, cameraRay, hit);
}
function stopDragging1() {
	if (!isMoving) return;
	isMoving = false;
	
	laser.transform.parent = null; Destroy(laser); // between
	
	stopDragging(assembly).saveScene('adjust');
}
function Start() {
	affordanceCollider = transform.collider;
	assembly = transform.parent.parent;
	shoulder = Camera.main.transform; // betweeen
}
function Update() {
	var hit:RaycastHit;
	if (isActive && Input.GetMouseButtonDown(0)) {
		var cameraRay = Camera.main.ScreenPointToRay(Input.mousePosition);
		if (!affordanceCollider.Raycast(cameraRay, hit, Mathf.Infinity)) {
			Debug.Log('no real start');
			stopDragging1(); return;
		}
		startDragging1(cameraRay, hit);
		return;
	} 	
	if (!isMoving 
			|| Input.GetMouseButtonUp(0)
			// We cast only against the Default layer (0). E.g., we don't want this to catch the gizmo on the HUD layer (8), nor assembly on IgnoreRaycast(2).
			) { // side-effect is new hit.point for doDragging
		stopDragging1(); return;
	}
	if (!Physics.Raycast(Camera.main.ScreenPointToRay(Input.mousePosition + cursorOffsetToSurface), hit, Mathf.Infinity, (1<<0))) {
		Debug.Log('fell off');
		stopDragging1(); return; }
	doDragging(assembly, null, null, hit);
}