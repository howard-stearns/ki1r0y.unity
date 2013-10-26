// (Attach to each such object. id and hash are set by Save/Restore scripts.)
public var id = ''; // The Kilroy persistence id.
public var localMounting = Vector3(0, -1, 0);
public var localFacing = Vector3(0, 0, -1);
public var nametag = '';
public var description = '';
public var author = '';
// Usually the same as id, but cand be different for groups (such as scenes).
// Used to determine if there's been a change.
public var hash = ''; 
public var versions:Object; // Only used for groups
public var timestamp:String;

// hashtable.Keys doesn't specify order. Here we have latest last.
function timestamps():Array {
	var keys = new Array(versions.Keys); 
	return keys.Sort();
}

function isGroup() {
	if (id == '') return false;
	return id.length != hash.length; 
}


public var kind = '';
function Start() {
	if (kind == '') {
		var m = gameObject.GetComponent.<MeshFilter>();
		if (!!m)  {
			kind = m.sharedMesh.name;
		} else {
			l = gameObject.GetComponent.<Light>();
			if (!!l) kind = l.type.ToString();
		}
		// When a prefab gets frobbed, the name changes from 'Foo' to 'Foo instance'.
		// We don't want that. (IWBNI we tracked that down.)
		var index = kind.IndexOf(' Instance');
		if (index >= 0) kind = kind.Remove(index);
	}
	if (kind == 'Plane') localFacing = Vector3(0, 1, 0);
}

// Answers the scene graph path to obj, suitable for use in Find().
// The browser will receive this and use it as the first arg to SendMessage.
function GameObjectPath():String {
	var path = id;
    /*var path = "/" + name;
    var obj = transform;
    while (obj.parent != null) {
        obj = obj.parent;
        path = "/" + obj.name + path;
    }*/
    return path;
}
function FindNametag(t:String):Transform {
	if (nametag == t) return transform;
	for (var child:Transform in transform) {
		var childObj = child.GetComponent.<Obj>();
		var got = childObj ? childObj.FindNametag(t) : null;
		if (got != null) return got;
	}
	return null;
}

public var mesh:GameObject;
public var dims:Vector3; // public for debuggin only. Use size().
public function size() { 
	if (!mesh) {
		var v = gameObject.transform.localScale;
		//var v = gameObject.transform.lossyScale;
		//Debug.Log(kind + '.size() => ' + v + '  ' + gameObject);
		return v;
	}
	return dims;
}
public function size(v:Vector3) { 
	if (!mesh) {  // i.e., temporary cube
		gameObject.transform.localScale = v;
		dims = v; 
		return v;
	}
	var s = v;
	// Unity planes are 10x10, and don't render at all unless there is a non-zero Y.
	if (kind == 'Plane') { s *= 0.1; s.y = 0.001; }
	mesh.transform.localScale = s;
	dims = v;
	return v;
}
public function isTargetable():boolean {
	return !!objectCollider();
}
public function bounds():Bounds { // Answer world space Bounds. (Do we want just our collider, or all children (i.e., renderer.bounds)?)
	var go = !!mesh ? mesh : gameObject;
	if (!go.collider) { return Bounds(go.transform.position, Vector3.zero); }
	return go.collider.bounds;
}
public function objectCollider():Collider { // Answer our Collider
	var go = !!mesh ? mesh : gameObject;
	return go.collider;
}
// Answer our shared Materials array (even if just an array of one). Side-effecting any resulting element (but not the whole Array) changes for all.
public function sharedMaterials():Material[] { 
	var go = !!mesh ? mesh : gameObject;
	var r = go.renderer;
	var m:Material[];
	var block = gameObject.GetComponent.<BlockDrawing>();
	if (!r && !block) m = new Material[0];
	else if (block) m = block.sharedMaterials();
	else m = r.sharedMaterials;
	return m;
}
// Assign new sharedMaterials and answer the new value.
public function sharedMaterials(mats:Material[]):Material[] {
	var go = !!mesh ? mesh : gameObject;
	var r = go.renderer;
	var block = gameObject.GetComponent.<BlockDrawing>();
	if (!r && !block && !mats.Length) return mats;
	else if (block) block.sharedMaterials(mats);
	else r.sharedMaterials = mats;	
	return mats;
}

// Answer the Kilroy GameObject of the given c, else c's non-avatar parent GameObject, else null.
public static function ColliderGameObject(c:Collider):GameObject { 
	if (c == null) { return null; }
	if (c.gameObject.GetComponent.<Obj>()) return c.gameObject;
	//Debug.Log('colliderGameObject(' + c.gameObject + ') parent:' + c.transform.parent.gameObject);
	if (!c.transform.parent) return null;  // e.g., avatar
	return c.transform.parent.gameObject;
}

/***************************************************************************************/
public function deleteObject() {
	enabled = false;  // first unhook me without destroying, so that I can save. Toplevel object have null parents, so null parent can't be used to tell.
//	Application.ExternalCall('notifyUser', 'deleted:' + nametag);
	saveScene('delete'); // will do the destroying on the callback.
	if (!saveEnabled()) Destroy(gameObject); // we won't get a callback, so scheduled Destroy now.
}

public static var SelectedId = null; // global state for this user.

// SceneSelect and ExternalPropertyEdit may both send browser 'select' with an optional idvtag to add to history.
// However, the functions here can also take a true/false/null addToHistory argument:
// false: from driving->SceneSelect or browser->goBackTo|RestoreBackTo: send select(...false)
// true: from click|metaclick|tab -> ExternalPropertyEdit: send select(...true)
// null: from SceneRestore=>GoToObj send nothing at all if SelectedId is wrong (see RestoreScene comments), otherwise send select(...true)
public static var NoShortCircuit = 'NonNullUnique'; // not an objectId or empty
public static function SceneSelect(addToHistory) { // Tell browser to select whole scene.
	if ((addToHistory == false /*explicitly*/) && !SelectedId) return; //unecessary calls don't hurt anything, but they can be confusing for logging.
	var root = GameObject.FindWithTag('SceneRoot');
	var rootComponent = root.GetComponent.<Obj>();
	var tag = rootComponent.nametag;
	Application.ExternalCall('props', rootComponent.GameObjectPath(), tag, rootComponent.author, rootComponent.description); // regardless of addToHistory, etc.
	if (addToHistory == null) {
		if (!SelectedId) return;
		else addToHistory = (SelectedId != NoShortCircuit);
	}
	SelectedId = null;
	Application.ExternalCall('select', rootComponent.id, tag, addToHistory ? rootComponent.hash : '', rootComponent.author);
}
function structureInfo(trans:Transform):Hashtable { // Not used yet. To appear below.
	var o = trans.gameObject.GetComponent.<Obj>(); 
	var d = new Hashtable();
	Debug.Log('info for ' + trans + ' ' + o);
	Debug.Log('details ' + o.id + ' ' + o.nametag);
	d[o.id] = o.nametag;
	return d;
}
// Tell external property editor about this object's editable properties, and select the object.
function ExternalPropertyEdit(tabName:String, addToHistory) {
	// Update properties regardless of whether we 'select' down below.
	var path = GameObjectPath();
	var pos = gameObject.transform.localPosition;
	var rot = gameObject.transform.localEulerAngles; //Not what we persist, but easier for users.
	var size = size();
	Application.ExternalCall('updatePosition', pos.x, pos.y, pos.z);
	Application.ExternalCall('updateRotation', rot.x, rot.y, rot.z);
	Application.ExternalCall('updateSize', size.x, size.y, size.z);
	Application.ExternalCall('props', path, nametag, author, description, true);
	/*var structure = {'children': new Array()};
	Debug.Log('parent:' + transform.parent);
	if (transform.parent != null) { structure['parent'] = structureInfo(transform.parent);}
	for (var child:Transform in transform) { 
		structure['children'].Push(structureInfo(child));
	}
	Application.ExternalCall('structure', JSON.Stringify(structure));*/

	if (addToHistory == null) {
		Application.ExternalCall('notifyUser', 'ExternalPropertyEdit(' + tabName + ', null), id=' + id + ', Obj.SelectedId=', Obj.SelectedId);
		if (Obj.SelectedId == id) return;
		else addToHistory = (SelectedId != NoShortCircuit);
	}
	SelectedId = id;
	Application.ExternalCall('select', id, nametag, addToHistory ? hash : '');
	Application.ExternalCall('tabSelect', tabName);
}

public var saver:Save; // Save script, if available.
function saveEnabled():boolean { return !!saver && saver.enabled; }
function Awake() { // Initialize saver, if available.
	if (saver == null) {
		var root = GameObject.FindWithTag('SceneRoot'); // Tag, because it could be named anything.
		if (root != null) saver = root.GetComponent.<Save>();
	}
}
function saveScene(action:String) { // Save whatever needs to be saved from the whole scene (or silently skip if not set up to save).
	if (!saveEnabled()) { return; } 
	//	debugging: Application.ExternalCall('notifyUser', 'now '+ transform.position.ToString() + ' ' + transform.eulerAngles.ToString() + ' ' + transform.lossyScale.ToString());	
	timestamp = saver.PersistScene(this, action); // for value and for the side-effect on id.
}
function savedScene(action:String, changes:Array):IEnumerator { // Callback from saveScene.
	yield gameObject.GetComponent.<PictureCapture>().Thumbnail(changes);
	Application.ExternalCall('saved', id, nametag, timestamp, action, hash);
	if (!enabled) { Destroy(gameObject); } // if deleted, can only safely be destroyed now.
}

/*****************************************************************************************/
// The following are all messages sent from outside, to change a property of this object.
// e.g., from browser-based property editors using GetUnity().SentMessage(path, functionName, singleArgument).
// SendMessage in the browser can only send one (String) argument (other than the path), so we need separate functions 
// for each of these.
function setPositionX(v:String) {var vec = transform.localPosition; transform.localPosition = Vector3(parseFloat(v), vec.y, vec.z); saveScene('sway');}
function setPositionY(v:String) {var vec = transform.localPosition; transform.localPosition = Vector3(vec.x, parseFloat(v), vec.z); saveScene('heave');}
function setPositionZ(v:String) {var vec = transform.localPosition; transform.localPosition = Vector3(vec.x, vec.y, parseFloat(v)); saveScene('surge');}

function setRotationX(v:String) {var vec = transform.localEulerAngles; transform.localEulerAngles = Vector3(parseFloat(v), vec.y, vec.z); saveScene('pitch');}
function setRotationY(v:String) {var vec = transform.localEulerAngles; transform.localEulerAngles = Vector3(vec.x, parseFloat(v), vec.z); saveScene('yaw');} 
function setRotationZ(v:String) {var vec = transform.localEulerAngles; transform.localEulerAngles = Vector3(vec.x, vec.y, parseFloat(v)); saveScene('roll');}

// While the gizmo is up, we just set localScale. StopGizmo() will recompute size from localScale.
function setSizeX(v:String) {var vec = transform.localScale; transform.localScale = Vector3(parseFloat(v)/size().x, vec.y, vec.z); saveScene('width');}
function setSizeY(v:String) {var vec = transform.localScale; transform.localScale = Vector3(vec.x, parseFloat(v)/size().y, vec.z); saveScene('height');}
function setSizeZ(v:String) {var vec = transform.localScale; transform.localScale = Vector3(vec.x, vec.y, parseFloat(v)/size().z); saveScene('length');}

function settag0(v:String) { nametag = v; saveScene('nametag'); }
function setDesc(v:String) { description = v; saveScene('description'); }
/***************************************************************************************/
public var deleteMe = false; // To delete in editor
function Update() {
	if (!deleteMe) return;
	deleteMe = false;
	deleteObject();
}