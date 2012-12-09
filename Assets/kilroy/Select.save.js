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
	if (isDragging) StopDragging();  // before we unselect.
	if (selected) {
		UnHighlight(selected.gameObject);
		selected = null;
	}
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
private var rt:Vector3;

function StartDragging(hit:RaycastHit) {
	var obj:GameObject = hit.collider.gameObject;
	var mountingDirection:Vector3 = selected.transform.TransformDirection(Vector3.down);
	var debugStrikePoint:Vector3 = hit.point;
	if (!Physics.Raycast(hit.point, mountingDirection, hit)) { return; }// Nothing under us to drag along
	Debug.DrawLine(debugStrikePoint, hit.point, Color.white, 10.0);
	// Test the reverse. 
	// First get point 1/100th of the way back towards the center. This is inside the obj bounding box.
	/*var offsetSurfacePoint:Vector3 = hit.point + ((hit.point - obj.transform.position) / 100.0);
	//Debug.DrawRay(offsetSurfacePoint, -mountingDirection, Color.magenta, 10.0);
	var reverseHit:RaycastHit;
	if (!Physics.Raycast(offsetSurfacePoint, -mountingDirection, reverseHit)) { 
		Debug.Log("No reverse"); 
	} else {
		var diff:Vector3 = offsetSurfacePoint - reverseHit.point;
		Debug.Log("diff = " + diff.magnitude);
	}*/
	// Set drag state
	isDragging = true;
	var contact:Vector3 = cam.WorldToScreenPoint(hit.point);
	contact.z = 0;
	cursorOffsetToSurface = contact - Input.mousePosition;
	lastDragPosition = hit.point;
	rt = selected.transform.right; //TransformDirection(Vector3.right);
	// Replace cursor with laser.
	Screen.showCursor = false;
	laser = Instantiate(laserPrefab.gameObject);
	between(laser, shoulder.position, hit.point, 0.05);
	laser.transform.parent = gameObject.parent; // before we set the gameObject to be under a pivot.
	// Setup up dragged obj layer and pivot
	savedLayer = obj.layer;
	obj.layer = 2; //Ignore Raycast layer.	
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
			var rt2:Vector3 = trans.right;
			var proj:double = Vector3.Dot(rt, up);
			var aligned:boolean = Mathf.Abs(proj) > 0.5;
			var fwd:Vector3;
			if (aligned)
				fwd = Vector3.Cross(trans.forward, up); //trans.up * -1 * proj, up) 
			else
				fwd = Vector3.Cross(rt, up);
			if (aligned) Debug.Log("aligned");
			else Debug.Log("fwd:" + fwd);
			if (fwd.magnitude < 0.1) 
				Debug.Log((aligned ? "aligned " : "") + 'proj=' + proj);
			Debug.DrawRay(hit.point, fwd, Color.blue);
			Debug.DrawRay(hit.point, up, Color.green);
			//Debug.DrawRay(hit.point, rt2, Color.red);

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
		UnSelect();
	}
	
}