private var cam:Camera;

function Awake () {
	cam = Camera.main;
}

private var oldColor:Color;

function Highlight(obj:GameObject) {
	oldColor = obj.renderer.material.color;
	obj.renderer.material.color = Color.green;
}

function UnHighlight(obj:GameObject) {
	obj.renderer.material.color = oldColor;
}


public var selected:Collider;

function Select(col:Collider) {
	UnSelect();
	selected = col;
	Highlight(selected.gameObject);
}

function UnSelect() {
	var didSomething:boolean = isDragging && !!selected;
	if (isDragging) StopDragging();  // before we unselect.
	if (selected) {
		UnHighlight(selected.gameObject);
		selected = null;
	}
	return didSomething;
}

// Utility functions
function between(verticalObject, p1, p2, width) {
	var offsetToCenter:Vector3 = (p1 - p2) / 2.0;
	verticalObject.transform.position = p1 - offsetToCenter;
	verticalObject.transform.up = p2 - p1;
	verticalObject.transform.localScale = Vector3(width, offsetToCenter.magnitude, width);
}

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

// Dragging state
private var isDragging:boolean = false;
private var savedLayer:int;
private var cursorOffsetToSurface:Vector3 = Vector3.zero;
private var laser:GameObject;

function StopDragging() {
	if (!isDragging) return;
	// Reset drag state.
	isDragging = false;
	cursorOffsetToSurface = Vector3.zero;
	// Restore dragged object
	selected.gameObject.layer = savedLayer;
	var pivot = selected.gameObject.transform.parent;
	selected.gameObject.transform.parent = pivot.parent;
	Destroy(pivot.gameObject);
	// Restore cursor
	Screen.showCursor = true;
	Destroy(laser);
}

public var laserPrefab:Transform;
public var shoulder:Transform;
public var pivotPrefab:Transform;

private var lastDragPosition:Vector3;
private var rt1:Vector3;
private var fwd1:Vector3;

function NotifyUser(msg) {
	// FIXME. Should really be some cool animation showing the problem, rather than text.
	Debug.LogWarning(msg);
}

function StartDragging(hit:RaycastHit) {
	var obj:GameObject = hit.collider.gameObject;
	savedLayer = obj.layer;
	var mountingDirection:Vector3 = -obj.transform.up;
	
	// Two Tests:
		
	// We will project the hit.point along the mountingDirection until we hit
	// a surface to slide along. No surface means we give up.
	obj.layer = 2; // Don't intersect with the object itself.
	var hasSurface:boolean = Physics.Raycast(hit.point, mountingDirection, hit);
	obj.layer = savedLayer;
	if (!hasSurface) { 
		NotifyUser("Nothing under object to slide along.");
		return; 
	}
	// Test the reverse: the surface hit point back to the object.
	// If it's too far away from the object, then we're not really touching the surface here.                                                                                         
    // First get point 1/100th of the way back towards the center. This is inside the obj bounding box. 
    var vectorTowardsCenter:Vector3 = (hit.point - obj.transform.position) / 100.0;
    var offsetSurfacePoint:Vector3 = hit.point + vectorTowardsCenter;              
    var reverseHit:RaycastHit;                                                                                   
    if (Physics.Raycast(offsetSurfacePoint, -mountingDirection, reverseHit)
    	&& (Vector3.Distance(offsetSurfacePoint, reverseHit.point)
    		> vectorTowardsCenter.magnitude * 2)) {
    	NotifyUser("This part of the object is not touching a surface.");
        return;                                                             
    }

	// Set drag state
	isDragging = true;
	var contact:Vector3 = cam.WorldToScreenPoint(hit.point);
	contact.z = 0;
	cursorOffsetToSurface = contact - Input.mousePosition;
	lastDragPosition = hit.point;
	rt1 = selected.transform.right; //selected.transform.TransformDirection(Vector3.right);
	fwd1 = selected.transform.forward;
	// Replace cursor with laser.
	Screen.showCursor = false;
	laser = Instantiate(laserPrefab.gameObject);
	between(laser, shoulder.position, hit.point, 0.05);
	laser.transform.parent = gameObject.parent; // before we set the gameObject to be under a pivot.
	// Setup up dragged obj and pivot
	obj.layer = 2;
	var pivot = Instantiate(pivotPrefab, hit.point, selected.transform.rotation);
	pivot.parent = selected.transform.parent;
	selected.transform.parent = pivot;
}


function Update () {
    var hit:RaycastHit;
    var pointerRay:Ray = cam.ScreenPointToRay(Input.mousePosition + cursorOffsetToSurface);
	if (Physics.Raycast(pointerRay, hit)) {
		if (Input.GetMouseButtonDown(0)) {
			StartDragging(hit);
		} else if (Input.GetMouseButtonUp(0)) {
			StopDragging();
		} else if (isDragging) {
			var delta = hit.point - lastDragPosition;
			if (!selected) {
				StopDragging();
				return;
			}		
			lastDragPosition = hit.point;
			between(laser, shoulder.position, hit.point, 0.1);
			var trans:Transform = selected.transform.parent;
			trans.Translate(delta, Space.World);
			var norm:Vector3 = hitNormal(hit);
			//var fwdx:Vector3 = trans.forward;
			//var upx:Vector3 = trans.up;
			//var proj:Vector3 = fwdx - (Vector3.Dot(fwdx, hit.normal)) * hit.normal;
			//var angle = 0.0; var axis = Vector3.zero; transform.rotation.ToAngleAxis(angle, axis); 
			
			var up:Vector3 = norm; //trans.TransformDirection(Vector3.up);
			var proj:float = Vector3.Dot(rt1, up);
			var aligned:boolean = Mathf.Abs(proj) > 0.9;
			var fwd:Vector3;
			if (aligned)
				//fwd = Vector3.Cross(trans.forward, up);
				fwd = fwd1;
			else 
				fwd = Vector3.Cross(rt1, up);
			Debug.DrawRay(hit.point, fwd, Color.blue);
			Debug.DrawRay(hit.point, up, Color.green);

			/*if (Mathf.Abs(Vector3.Dot(fwd2, norm)) > 0.5) {
				var tmp:Vector3 = fwd2;
				fwd2 = up2;
				up2 = tmp;
			}*/
			var rot:Quaternion = 
				//Quaternion.AngleAxis(angle, norm);  // Bad.
				//Quaternion.LookRotation(fwdx, norm);  // Too stable. Preserves forward forward and up second.
				//Quaternion.LookRotation(Vector3.forward, norm); // Too stable.
				//Quaternion.LookRotation(proj, norm); // Mostly like trans.up = norm, below, but not not really.
				//Quaternion.FromToRotation(upx, norm);  // Very jittery
				//Quaternion.FromToRotation(Vector3.up, norm); // Works, but sometimes has rotation around local z.
				Quaternion.LookRotation(fwd, up);
			trans.rotation = rot;
			//trans.up = norm;  // same as using FromToRotation(Vector3.up, norm), above.
			
			//selected.transform.parent.rotation = Quaternion.FromToRotation(selected.transform.parent.up, norm);
			//if (Mathf.abs(norm.dot(Vector3.right)) > 0.99) {
			//	selected.transform.forward = Vector3.forward;
			//} else {
			//	selected.transform.parent.right = Vector3.right;
			//}
		} else if (hit.collider != selected) {
			Select(hit.collider);
		}
	} else {
		if (UnSelect()) NotifyUser("You have reached the edge of all surfaces.");
	}
	
}