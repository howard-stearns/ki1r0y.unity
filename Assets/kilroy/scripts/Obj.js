// Standard behavior for each kilroy object in the scene graph. 
// (Attach to each such object. id and hash are set by Save/Restore scripts.)
public var id = ''; // The Kilroy persistence id.
public var localMounting = Vector3(0, -1, 0);
public var localFacing = Vector3(0, 0, -1);

function isGroup() {
	if (id == '') return false;
	return id[0] == 'G'[0];
}

// Usually empty or same as id, but cand be different for groups (such as scenes).
// Used to determine if there's been a change.
public var hash = ''; 

public var kind = '';
function Start() {
	if (kind == '') {
		var m = gameObject.GetComponent(MeshFilter);
		if (m != null)  kind = m.sharedMesh.name;
	}
	if (kind == 'Plane') localFacing = Vector3(0, 1, 0);
}

// Answers the scene graph path to obj, suitable for use in Find().
function GameObjectPath(obj:GameObject):String {
    var path = "/" + obj.name;
    while (obj.transform.parent != null) {
        obj = obj.transform.parent.gameObject;
        path = "/" + obj.name + path;
    }
    return path;
}
public static var selectedId = null;
public static function SceneSelect() { SceneSelect(false); }
public static function SceneSelect(force:boolean) {
	if (force || (selectedId != null)) {
		selectedId = null;
		var sname = GameObject.FindWithTag('SceneRoot').name;
		Debug.Log('browser select scene ' + sname);
		if (Application.isWebPlayer) {
			Application.ExternalCall('select', null, sname);
			Application.ExternalCall('props', '/');
		}
	}
}
function deleteObject() {
	var path = GameObjectPath(gameObject);
	transform.parent = null;
	Destroy(gameObject);
	Application.ExternalCall('notifyUser', 'deleted:' + path);
}

// Tell external property editor about this object's editable properties.
function ExternalPropertyEdit(tabName:String) {
	var path = GameObjectPath(gameObject);
	selectedId = id;
	Debug.Log('browser select ' + id + ' ' + path + ' ' + tabName);
	//Debug.Log('localScale ' + gameObject.transform.localScale.ToString() + ' globalScale: ' + gameObject.transform.lossyScale.ToString());
	if (Application.isWebPlayer) {
		Application.ExternalCall('notifyUser', id + ' ' + tabName + ' ' + path);
		Application.ExternalCall('select', id, gameObject.name);
		Application.ExternalCall('tabSelect', tabName);
		var pos = gameObject.transform.localPosition;
		var rot = gameObject.transform.localEulerAngles; //Not what we persist, but easier for users.
		var scale = gameObject.transform.lossyScale;
		Application.ExternalCall('updatePosition', pos.x, pos.y, pos.z);
		Application.ExternalCall('updateRotation', rot.x, rot.y, rot.z);
		// FIXME: we must use id as name, because tags/name are not guaranteed to be unique!!
		Application.ExternalCall('props', path, scale.x, scale.y, scale.z);
	}
}

public var saver:Save; // Save script, if available.
function Awake() { // Initialize saver, if available.
	if (saver == null) {
		var root = GameObject.FindWithTag('SceneRoot'); // Tag, because it could be named anything.
		if (root != null) saver = root.GetComponent(Save);
	}
}
function saveScene() { // Save whatever needs to be saved from the whole scene (or silently skip if not set up to save).
	if (saver == null || !saver.enabled) return;
	Application.ExternalCall('notifyUser', 'now '+ transform.position.ToString() + ' ' + transform.eulerAngles.ToString() + ' ' + transform.lossyScale.ToString());
	saver.Persist(saver.gameObject);
}

/*****************************************************************************************/
// The following are all messages sent from outside, to change a property of this object.
// e.g., from browser-based property editors using GetUnity().SentMessage(path, functionName, singleArgument).
// SendMessage in the browser can only send one (String) argument (other than the path), so we need separate functions 
// for each of these.
function setPositionX(v:String) {var vec = transform.position; transform.position = Vector3(parseFloat(v), vec.y, vec.z); saveScene();}
function setPositionY(v:String) {var vec = transform.position; transform.position = Vector3(vec.x, parseFloat(v), vec.z); saveScene();}
function setPositionZ(v:String) {var vec = transform.position; transform.position = Vector3(vec.x, vec.y, parseFloat(v)); saveScene();}

function setRotationX(v:String) {var vec = transform.eulerAngles; transform.eulerAngles = Vector3(parseFloat(v), vec.y, vec.z); saveScene();}
function setRotationY(v:String) {var vec = transform.eulerAngles; transform.eulerAngles = Vector3(vec.x, parseFloat(v), vec.z); saveScene();}
function setRotationZ(v:String) {var vec = transform.eulerAngles; transform.eulerAngles = Vector3(vec.x, vec.y, parseFloat(v)); saveScene();}

function setScale(v:String, index:int) {
	var dbg = 'set v:' + v + ' i:' + index.ToString();
	var global = transform.lossyScale; 
	dbg += ' lossy:' + global.ToString();
	global[index] = parseFloat(v);
	dbg += ' now:' + global.ToString();
	var reorientedGlobal = transform.parent.InverseTransformDirection(global);
	dbg += ' transfd:' + reorientedGlobal.ToString();
	transform.localScale = reorientedGlobal;
	dbg += ' new:' + transform.lossyScale.ToString();
	Application.ExternalCall('notifyUser', dbg);
	saveScene();
}
function setScaleX(v:String) {setScale(v, 0);}
function setScaleY(v:String) {setScale(v, 1);}
function setScaleZ(v:String) {setScale(v, 2);}
