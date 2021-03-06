// BUGS:
// Drag orientation not s table.
// Overlapping picture won't wrap. (Bug in PictureDrawing.)

function Log(s:String) {
	//Debug.Log('Select: ' + s);
}
function NotifyUser(msg) {
	if (Application.isWebPlayer) {
		//Application.ExternalEval("console.log('" + msg + "');");
		Application.ExternalCall('notifyUser', msg);
	} else {	// FIXME. Should really be some cool animation showing the problem, rather than text.
		print(msg);
	}
}
function StatusMessageStart(msg) {
	if (Application.isWebPlayer) {
		Application.ExternalCall('statusMessageStart', msg);
	} else {
		Debug.LogWarning(msg);
	}
}
function StatusMessageUpdate(msg, update, progress) {
	if (Application.isWebPlayer) {
		Application.ExternalCall('statusMessageUpdate', msg, update, progress);
	} else {
		Debug.LogWarning(msg + ': ' + (update || 'completed') + ' ' + progress);
	}
}

private var cam:Camera;  // The camera in which screen coordinates are defined.

///////////////////////////////////////////////////////////////////
// File drag and drop.
// Message from the browser to here can only take one argument.
// We break file drop into multiple messages:
//    setImportTarget('ScreenXxScreenY') or setImportObject(path)   - once per drop
//    setImportFilename('name') - once per file
//    importImage('URL') - once per file in the drop (file URL in editor, data url in browser)
public var picturePrefab:Transform;
public var dropTarget:RaycastHit;
public var dropObject:Transform;
function setPlacement(pos:Vector3[], rot:Quaternion[]) {
	var pt = dropTarget.point;
	// IWBNI if we animated between this first pos/rot (which is floating half way between camera and surface, perpendicular to camera)
	// and the second pos/rot (below, which is pushed back to the intersecting surface, and on it).
	//var v = pt - cam.transform.position;
    //if (v.magnitude < 1) v = v.normalized;
    //pos[0] = cam.transform.position + (v / 2);
    //rot[0] = Quaternion.LookRotation(v);
    var v = (cam.transform.position - pt).normalized;
    
 	var norm = Sticky.HitNormal(dropTarget);
    pos[0] = pt + (norm * 0.1);
    
    if (!dropObject) { dropObject = GameObject.FindWithTag('SceneRoot').transform; }
    
   	// We really want object to be positioned against object as though slide along it.
 	// For most objects, the mounting direction is down, so this means a further rotation around X.
 	// (In fact, we might someday have other mounting directions, and for imported kilroy objects, we haven't completed
 	//  finished reading the object in at this point, so we wouldn't know any non-standard dimensions. For now, assume normal mounting.)
 	// This will leave blocks half-embedded in the selected object, but that's good enough for now.
 	
 	// Textures on Plane primitives are upside down to what we want, so this requires that the internal Plane child
 	// be rotated 180 around local y relative to the main obj, roughly similar to the way we manuall orient block faces.
 	// Note that this has to be in the part definition rather than code, because we don't want code to conditional
 	// on the type of object, when we don't know at the start of an object import what type it will be. 
 	
 	// Shall we integrate this code with that in Select.js?
 	var aligned = Mathf.Abs(Vector3.Dot(dropObject.up, norm)) > 0.9;
 	var surfaceLeft = Vector3.Cross(aligned ? dropObject.forward : dropObject.up, norm);
 	var vert = Vector3.Cross(norm, surfaceLeft);
 	var out = Vector3.Cross(surfaceLeft, vert);
	rot[0] = Quaternion.LookRotation(vert, out);
	//Debug.LogWarning('aligned=' + aligned + ' norm=' + norm + ' surfaceLeft=' + surfaceLeft + ' vert=' + vert + ' out=' + out);
	
	/*var rt1 = dropObject.right; 
	var fwd1 = dropObject.forward;
	var alignedX = Mathf.Abs(Vector3.Dot(rt1, norm)) > 0.9;
	var fwd = alignedX ? fwd1 : Vector3.Cross(rt1, norm);
	Debug.Log('alignedX=' + alignedX + ' fwd=' + fwd + ' norm=' + norm);
	rot[0] = Quaternion.LookRotation(fwd, norm);*/

 	/* var up = Vector3.up;
   	if (Mathf.Abs(Vector3.Dot(up, norm)) > 0.9) { up = Vector3.Cross(Vector3.right, norm); }
	rot[0] = Quaternion.LookRotation(-norm,  up);
 	//rot[0] *= Quaternion.AngleAxis(-90, Vector3.right);
 	//rot[0] *= Quaternion.AngleAxis(180, Vector3.up);
 	Debug.LogWarning('pt=' + pt + ' v=' + v + ' norm=' + norm + ' pos=' + pos[0] + ' up=' + up + ' rot=' + rot[0]);*/
 }
// Browser input button file input sets an object, not a coordinate.
function setImportObject(path:String) { 
	dropObject = null; 
	if (path != '/') { dropObject = Obj.FindByPath(path).transform; }
	NotifyUser('drop to ' + dropObject + ' @' + dropObject.position);
	var pointerRay:Ray = Ray(cam.transform.position, dropObject.position - cam.transform.position);
	dropObject.GetComponent.<Obj>().objectCollider().Raycast(pointerRay, dropTarget, Mathf.Infinity); 
	Debug.Log('ray: ' + pointerRay.origin + ' + ' + pointerRay.direction + ' ' + dropTarget.point + ' on ' + dropTarget.transform);
}
function findObj(trans:Transform):Transform {
	if (trans.gameObject.GetComponent(Obj)) { return trans; }
	if (trans.parent) { return findObj(trans.parent); }
	return null;
}
function setImportTarget(coordinates:String) {
	var pair = Save.splitPath(coordinates, 'x'); 
	var x:int = int.Parse(pair[0]);
	var y:int = int.Parse(pair[1]);
    var pointerRay:Ray = cam.ScreenPointToRay(Vector3(x, y, 0)); 
    Sticky.RemoveAdjuster(true); // if any. No need to retore as we'll be dealing with an import. 
 	if (Physics.Raycast(pointerRay, dropTarget)) {
 		dropObject = findObj(dropTarget.transform);
		/*NotifyUser*/Debug.LogWarning('got object ' + dropTarget.transform.gameObject + ' (' + dropObject + ') at ' + x + 'x' + y);
	} else {
		/*NotifyUser*/Debug.LogWarning('no drop target found at ' + x + 'x' + y);
		dropObject = null;
	}
}
public var currentDropFilename:String;
function setImportFilename(name:String) {
	// In the browser, the importImage url will be a data url, which does not have a filename.
	// But we need a filename in order to be able to give the user meaningful
	// error/progress messages.
	currentDropFilename = name;
}
function importThing(id:String) { // A kilroy object, e.g., from search results
	var pos = new Vector3[1]; var rot = new Quaternion[1]; setPlacement(pos, rot);
	var scene = GameObject.FindWithTag('SceneRoot');
	NotifyUser('importThing(' + id + ') scene:' + scene);

	var restore = scene.GetComponent.<Restore>();
	// causes a saveScene() when the restore is complete.
	restore.savePath = dropObject.gameObject.GetComponent.<Obj>().GameObjectPath() + '/import';
	Debug.Log('set ' + restore + ' destinationPath=' + restore.savePath);
	// instance argument is something that won't be found in dropObject, so RestoreChild makes a new object.
	var imported = restore.RestoreChild(id, id, 'import', dropObject); // the instance name will get adjusted as soon as we save
	imported.transform.position = pos[0];
	imported.transform.rotation = rot[0];
}
// This version merely restores the scene and renames/saves when done.
// That's not going to be good enough for multi-user, in which the scene might be occupied, and we don't want to disrupt each other.
// We'll need some sort of exclusive mode in which we restore our own private version without connecting to anyone.
function copyScene(id:String) { 
	var restore = GameObject.FindWithTag('SceneRoot').GetComponent.<Restore>();
	restore.savePath = '/';  // renames and saves on SceneReady 
	restore.RestoreScene(':' + id, true);
}
function powerOfTwo(size:int):int { // answer next larger power of two, up to 1024. (Our display maxes at 600px wide.)
	var p = 0;
	for (p in [16, 32, 64, 128, 256, 512, 1024]) { if (p >= size) { break; } }
	return p;
}
function importImage(url:String) {  // Here, rather than Restore or Obj, because this is per user. Might ref user data.
	var max = url.Length; if (max > 256) max = 128;
	var pos = new Vector3[1]; var rot = new Quaternion[1]; setPlacement(pos, rot);
	var scene = GameObject.FindWithTag('SceneRoot');
	NotifyUser('importing: ' + url.Substring(0, max) + ' to ' + pos[0]); //because .NET has to be different. No slice.
	
	var inputData:WWW = new WWW(url); 
    yield inputData;  // Do this now, before instantiating the picture, so that we don't have an ugly gray thing sitting there
    // Users can interactively tile this texture onto meshes. Set up the ability to do this now, just once.
    var txt = inputData.texture;
    // We could import small pixel sizes as small objects, but that makes them hard to manipulate.
    // Instead, let's just preserve an aspect ratio to a height of 1.
    var originalAspectWidth = (1.0 * txt.width) / txt.height;
 	// Most graphics cards won't repeat-wrap unless it's a power of 2. 
	var u = powerOfTwo(txt.width); var v = powerOfTwo(txt.height); 
	if ((u != txt.width) || (v != txt.height)) {
		NotifyUser('resizing ' + txt.format + ' data from ' + txt.width + ' x ' + txt.height + ' to ' + u + ' x ' + v);
		TextureScale.Bilinear(txt, u, v);
		NotifyUser('resizing complete');
	} else {
	    NotifyUser('received import data ' + txt.width + ' x ' + txt.height);
	}
	txt.wrapMode = TextureWrapMode.Repeat;
    
    var pict = Instantiate(picturePrefab, pos[0], rot[0]);
    var obj = pict.GetComponent.<Obj>();
    //pict.transform.Rotate(0, 180, 0); // if setPlacement has bottom along surface normal
    //pict.transform.Rotate(90, 0, 0); // if setPlacement has forward (look) along normal
    pict.transform.parent = dropObject;
    obj.size(Vector3(originalAspectWidth, 0, 1));

    var bytes = txt.EncodeToPNG(); // Our upload is always image/png, regardless of drop.
   	var id = Utils.sha1(bytes);
    var mats = obj.sharedMaterials();
    var mat = Material(mats[0]);
    mat.mainTexture = txt;
    mat.mainTexture.anisoLevel = 9;
    mat.mainTexture.name = id + '.png';
    mats[0] = mat;
    obj.sharedMaterials(mats);
    obj.nametag = currentDropFilename;
    obj.description = "Picture imported into " + GameObject.FindWithTag('SceneRoot').GetComponent.<Obj>().nametag + " by " + Save.userNametag + ".";
    
    // FIXME? Does the upload have to come after saveScene, in case there are two gcs between upload and rooting an object?
    var form = new WWWForm();
    form.AddBinaryData('fileUpload', bytes, currentDropFilename, 'image/png');
   	// Media upload is generally pretty slow, and we don't want the user
    // to exit the browser or close their laptop during that time, so we
    // let the user know what's happening.
    // IWBNI we showed upload progress, but WWW.uploadProgress is broken in the Web player.
    var msg = 'Saving ' + currentDropFilename;
    StatusMessageStart(msg);
	var upload = WWW('http://' + Save.host + '/media/' + id, form);
	yield upload;
	var result = upload.error
		? ('Failed upload of ' + currentDropFilename  + ': ' + upload.error.replace('downloading', 'uploading')) //Unity error message is confusing
		: 'Saved ' + currentDropFilename + ': ' + upload.text;
	StatusMessageUpdate(msg, result, 1.0);
	
	if (!upload.error) { 
		Save.AddTabItem(pict);
		obj.saveScene('import'); 
	}
}
/*function Start() {  // For debugging
	if (Application.isWebPlayer) return;
	var delay = 3;
	
	yield WaitForSeconds(4);
	var basename = 'avatar.jpg';
	var furl = 'file:///Users/howardstearns/Pictures/' + basename;
	setImportFilename(basename);

	//setImportTarget('374x300'); 
	//setImportTarget('374x100');
	
	Debug.LogError('import on PjcKM3kgWuRHR8vLHlCv6ZEYOvM');
	setImportObject('/G1/G1floor/PjcKM3kgWuRHR8vLHlCv6ZEYOvM'); 
	yield WaitForSeconds(delay); importImage(furl);
	//yield WaitForSeconds(delay); importThing('HKKy1I0XGPkf0AQHyunhD5tStsw');
	//yield WaitForSeconds(delay); importThing('VdO3Xx-QEIXGxlALLto1iyXykls');
	
	Debug.LogError('import on Hzc3ZvJoi-8HaXu62YQqzNvZgaA');
	setImportObject('/G1/G1floor/Hzc3ZvJoi-8HaXu62YQqzNvZgaA');
	//yield WaitForSeconds(delay); importImage(furl);
	//yield WaitForSeconds(delay); importThing('HKKy1I0XGPkf0AQHyunhD5tStsw');
	yield WaitForSeconds(delay); importThing('VdO3Xx-QEIXGxlALLto1iyXykls');
	
	Debug.LogError('import on G1floor');
	setImportObject('/G1/G1floor');
	//yield WaitForSeconds(delay); importImage(furl);
	//yield WaitForSeconds(delay); importThing('HKKy1I0XGPkf0AQHyunhD5tStsw');
	yield WaitForSeconds(delay); importThing('VdO3Xx-QEIXGxlALLto1iyXykls');
	
	Debug.LogError('import on b7eDSLf3OZIb7J4R4O-jf6_UX6E');
	setImportObject('/G1/G1floor/b7eDSLf3OZIb7J4R4O-jf6_UX6E');
	//yield WaitForSeconds(delay); importImage(furl);
	//yield WaitForSeconds(delay); importThing('HKKy1I0XGPkf0AQHyunhD5tStsw');
	yield WaitForSeconds(delay); importThing('VdO3Xx-QEIXGxlALLto1iyXykls');
	
	Debug.LogError('import on FLEbFC7J8Xy9C0V6a2cyGCCcUbk');
	setImportObject('/G1/G1floor/FLEbFC7J8Xy9C0V6a2cyGCCcUbk');
	//yield WaitForSeconds(delay); importImage(furl);
	//yield WaitForSeconds(delay); importThing('HKKy1I0XGPkf0AQHyunhD5tStsw');
	yield WaitForSeconds(delay); importThing('VdO3Xx-QEIXGxlALLto1iyXykls');

	Debug.LogError('Import tests complete');
}*/


/****************************************************************************************************/
// To highlight an object (e.g., for mouseover), we install in object a copy of it's materials,
// and then oscilate the color.
private var oldMaterials:Material[];    		// A copy of the material original material set.
private var oscillateStartTime = 0.0;  			// 0 stops any oscillating coroutine.
public var period = (2 * 0.8)/(2 * Mathf.PI); 	// Two beats of our standard 75bpm tempo.
// Highlight go. Behavior is undefined if any object (same go or not) is already highted.
function Highlight(go:GameObject) {
	if (!go) return;
	var obj = go.GetComponent.<Obj>();
	if (!obj || !obj.isTargetable()) return;  // Attempt to highlight the avatar or some such
	oscillateStartTime = Time.time;
	// We must make a copy of the materials before we start throbbing them, because they might share with other materials.
	oldMaterials = obj.sharedMaterials();
	// If material hasn't loaded yet, there are several places and times, below where there might be nulls.
	if ((oldMaterials == null) || !oldMaterials.Length) return;  
	var mats = new Material[oldMaterials.Length];
	var oldColors = new Color[oldMaterials.Length];
	for (var m = 0; m < mats.Length; m++) {
		var oldMat = oldMaterials[m];
		if (oldMat == null)  return;
		mats[m] = Material(oldMat);
		oldColors[m] = oldMat.color;
	}
	obj.sharedMaterials(mats);
	//mat.SetColor('_Emission', Color.white);
	while (oscillateStartTime != 0.0) {
		var fraction = (1 + Mathf.Sin((Time.time - oscillateStartTime)/period + Mathf.PI/2.0)) /2.0;
		//var fraction = Mathf.PingPong(Time.time - oscillateStart, 1.0);
		fraction = fraction / 3.0 + 0.666667;
		for (var i = 0; i < mats.Length; i++) {
			mats[i].color = fraction * oldColors[i];
			//mat.SetColor('_Emission', (1 - fraction) * oscillateStartColor);
		}
		yield;
	}
}
// Remove highlighting from obj. Behavior is undefined if obj was not the most recently highlighted.
function UnHighlight() { if (selection != null) UnHighlight(selection); }
function UnHighlight(go:GameObject) {
	if (!oldMaterials || !oldMaterials.length) return;
	var obj = go.GetComponent.<Obj>();
	if (!obj || !obj.isTargetable()) return;
	oscillateStartTime = 0;
	obj.sharedMaterials(oldMaterials);
	oldMaterials = null;
}

/****************************************************************************************************/
// The gizmo is the interactive in-scene object used to adjust position/orientation/scale of objects.
public var gizmoPrefab:Transform;  // The prefab.
public var gizmo:Transform;  // The currently active gizmo. Should we really instantiate/destroy each time?
//public var gizmoOldParent:Transform; // When gizmo is on, it's parent object is held by avatar.
public function StopGizmo():GameObject { // Stop any running gizmo and return the associated gameObject, else null;
	if (!gizmo) return null;
	//gizmo.parent.parent = gizmoOldParent;
	//gizmoOldParent = null;
	var old = gizmo.parent.gameObject;
	Directional.ApplyChanges(gizmo.parent);
	Destroy(gizmo.gameObject);
	gizmo = null;
	return old;
}
public function StartGizmo(go:GameObject) { // start a gizmo on the given gameObject. Does nothing if arg is null.
	if (go == null) { return; } 
	if (go.tag == 'SceneRoot') { return; } // no gizmo for scene as a whole
	if (go.GetComponent.<Obj>().frozen) { return; }
	StopGizmo();
	Sticky.RemoveAdjuster();
	//UnSelection();
	var trans = go.transform;
	gizmo = Instantiate(gizmoPrefab, trans.position, trans.rotation).transform;
	gizmo.parent = trans;
	var goSize = go.GetComponent.<Obj>().scalar(0.0);
	gizmo.localScale *= 0.4 * goSize;
	gizmo.gameObject.BroadcastMessage('updateAssembly', trans, SendMessageOptions.DontRequireReceiver);
	// trans.parent.localScale will mess us up:
	//gizmoOldParent = trans.parent;
	//trans.parent = transform; // e.g. avatar
}
public function StartGizmo(path:String) { // StargGizmo for the given GameObjectPath().
	if (!path) return;
	StartGizmo(Obj.FindByPath(path));
}

/************************************************************************************/
public var adjusterPrefab:Transform;
public var selection:GameObject;
function Selection(col:GameObject) {
	if (col == selection) return;
	    if (!!selection) return; // experiment
	    if (!col.GetComponent(Obj)) return; //experiment
	UnSelection();
	selection = col;
	Sticky.SetAssemblyLayer(col, 2); var g = Instantiate(adjusterPrefab, col.transform.position, col.transform.rotation); g.name = 'Adjuster'; g.transform.parent = col.transform; // Highlight(selection);
}
function UnSelection():boolean { // May or may not have been dragging. Answer true if we were.
	var didSomething:boolean = !!selection;
	if (selection != null) {
		//Sticky.RemoveAdjuster(selection.transform); Sticky.SetAssemblyLayer(selection, 0); //UnHighlight(selection);
		selection = null;
	} 
	return didSomething;
}

function Update () {
	if (Input.GetAxis("Horizontal") || Input.GetAxis("Vertical")) {
		OverlayControls.TrackMouseMotion(true);
		//StopGizmo(); we don't stop gizmo on driving -- just on public/properties tab switch
		//UnSelection();
		Obj.SceneSelect(false);
		return;
	}
	//if (gizmo) return;
    /*var hit:RaycastHit;
    // We don't use OnMouseDown and friends, because that doesn't tell us the precise hit.point.
    // As long as we're going to need to Raycast, we might as well do that to start.
    // We cast only against the Default layer (0). E.g., we don't want this to catch the gizmo on the HUD layer (8).
 	if (Physics.Raycast(cam.ScreenPointToRay(Input.mousePosition), hit, Mathf.Infinity, (1<<0))) { 
 		var obj = Obj.ColliderGameObject(hit.collider);
   		//Selection(obj); 
   		if (!!obj && !!obj.GetComponent(Obj)) Sticky.AddAdjuster(obj.transform, adjusterPrefab); 		
 	}*/ //else {
 	/*if (!!selection && !selection.GetComponent(Obj).objectCollider().Raycast(cam.ScreenPointToRay(Input.mousePosition), hit, Mathf.Infinity)) {	

		if (UnSelection()) NotifyUser("You have reached the edge of all surfaces.");
	}*/
}

/************************************************************************************/
function Awake() {
	cam = Camera.main;
}
