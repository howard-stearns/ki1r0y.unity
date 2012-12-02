public var id = ''; // The BMW persistence id.

// Usually empty or same as id, but cand be different for groups (such as scenes).
// Used to determine if there's been a change.
public var hash = ''; 

function GameObjectPath(obj:GameObject):String {
    var path = "/" + obj.name;
    while (obj.transform.parent != null) {
        obj = obj.transform.parent.gameObject;
        path = "/" + obj.name + path;
    }
    return path;
}

// The Select script defines a selected var, which includes hover-selection.
// FIXME: adjust the terminology.

// NB: Doc says this doesn't work on iPhone. What does?
function OnMouseDown() {
	var path = GameObjectPath(gameObject);
	Debug.Log('click ' + id + ' ' + path);
	Debug.Log('localScale ' + gameObject.transform.localScale.ToString() + ' globalScale: ' + gameObject.transform.lossyScale.ToString());
	if (Application.isWebPlayer) {
		Application.ExternalCall('select', id);
		var pos = gameObject.transform.localPosition;
		var rot = gameObject.transform.localEulerAngles; //Not what we persist, but easier for users.
		var scale = gameObject.transform.lossyScale;
		Application.ExternalCall('updatePosition', pos.x, pos.y, pos.z);
		Application.ExternalCall('updateRotation', rot.x, rot.y, rot.z);
		// FIXME: we must use id as name, because tags/name are not guaranteed to be unique!!
		Application.ExternalCall('props', path, gameObject.name, scale.x, scale.y, scale.z);
	}
}

private var saver:Save;
function saveScene() {
	if (saver == null) {
		var root = GameObject.FindWithTag('SceneRoot');
		saver = root.GetComponent(Save);
	}
	Application.ExternalCall('notifyUser', 'now '+ transform.position.ToString() + ' ' + transform.eulerAngles.ToString() + ' ' + transform.lossyScale.ToString());
	saver.Persist(saver.gameObject);
}
// SendMessage in the browser can only send one (String) argument (other than the path), so we nee separate functions 
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
//	saveScene();
}
function setScaleX(v:String) {setScale(v, 0);}
function setScaleY(v:String) {setScale(v, 1);}
function setScaleZ(v:String) {setScale(v, 2);}
