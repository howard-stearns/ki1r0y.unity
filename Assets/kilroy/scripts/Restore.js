static function Log(s:String) {
	//Debug.Log('Restore: ' + s);  // Can be commented in/out for debugging.
}

function Fetch(id):WWW {
	return new WWW('http://' + Save.host + '/thing/' + id);
	//return new WWW('file:///Users/howardstearns/Beyond-My-Wall/server/kilroy/db/immutable/' + id);
}
// Together, these two functions handle several permutations on how we might store objects:
// {name:val0, key1:val1, ...}
// {hash:xxx} in one file, and {name:val0, key1:val1, ...} in file xxx.
function Parsed(www:WWW):Hashtable {
	var serialization = www.text;
	// Alas, www.error is empty on 404s!
	if (!String.IsNullOrEmpty(www.error) || (www.text[0] != '{'[0])) {
		Application.ExternalCall('errorMessage', www.error || www.text);
		return null;
	}
	var data = JSON.Parse(serialization);
	return data;
}
// Coroutine to fetch id into holder[0], which may require two GETs.
// The actual hash will be set in data (which might not be the same as id for Groups).
// (Of course, hash could not be in the serialized data, because that would affect the hash.)
function FetchInto(holder:Hashtable[], id:String) {
	var www = Fetch(id);
	Log('fetching ' + www.url);
   	yield www;
	var data:Hashtable = Parsed(www);
	if (!data) { return; }
	var hash:String = data['idvtag'];
	if (hash) { // separately stored group and object info
		www = Fetch(hash);
		Log('fetching group data ' + www.url);
		yield www;
		data = Parsed(www);
		if (!data) { return; }
	} else {
		hash = id;
	}
	data['idvtag'] = hash;
	holder[0] = data;
}

// Functions for making primitives of the given data objects.
static function makeVector3(data:Hashtable):Vector3 {
	return Vector3(data['x'], data['y'], data['z']);
}
static function makeQuaternion(data:Hashtable):Quaternion {
	return Quaternion(data['x'], data['y'], data['z'], data['w']);
}
public var blockPrototype:Transform;  // Our 6-textured block
// Answer a primitive appropriate for the given data, or null for unknown/group.
function makeType(data:Hashtable):GameObject {
	var go:GameObject;
	var type:String = data['type'];
	var pt:Object = null;
	if (type == 'Plane') pt = PrimitiveType.Plane;
	//else if (type == 'Cube') pt = PrimitiveType.Cube;
	else if (type == 'Sphere') pt = PrimitiveType.Sphere;
	if (pt != null) go = GameObject.CreatePrimitive(pt);
	else if (type == 'Cube') go = Instantiate(blockPrototype.gameObject);
	else {
		if (type == 'Directional') pt = LightType.Directional;
		else if (type == 'Point') pt = LightType.Point;
		else if (type === 'Spot') pt = LightType.Spot;
		go = new GameObject(); 
		if (pt != null) {
			var light = go.AddComponent(Light);
			light.type = pt;
			light.intensity = data['intensity'];
		} // else group
	}
	return go; 
}


function FillTexture(mat:Material, id:String) {
	// TODO: WWW in Unity editor is certainly not caching, despite Cache-Control/Expires.
	// See if the browser plugin and standalone is as bad.
	// See http://unity3d.com/webplayer_setup/setup-3.x/
	var url = 'http://' + Save.host + '/media/' + id;
	Log('fetching texture ' + url + ' into ' + mat);
	var www:WWW = new WWW(url);
   	yield www;
   	mat.mainTexture = www.texture;
   	mat.mainTexture.name = id;
   	Log('retrived texture ' + id + 'into ' + mat);
}

var nRemainingObjects = 0;  // The number we have started to fetch, but which have not yet been resolved (not counting media).
// Immediately answers a (possibly new) child of parent, and starts asynchronously 
// fetching the real data. If id does not already name a child, then create a 
// visible cube that will be used as a stand-in of the correct position/size/rotation
// (because the parent has that info). When the data arrives, it will replace the cube.
function RestoreInto(id:String, hash:String, parent:Transform) {
	var fixme = hash;
	hash = hash || id;
	var child = parent.Find(id);
	var newChild = !child;
	if (newChild) {
		child = GameObject.CreatePrimitive(PrimitiveType.Cube).transform;
		child.parent = parent;
	} else {  // if hash is already right, we're done.
		var obj = child.GetComponent(Obj);
		if (obj && (obj.hash == hash)) return child.gameObject;
	}
	nRemainingObjects++;
	StartCoroutine( Inflate(child.gameObject, id, hash, newChild) );
	return child.gameObject;
}
// Coroutine to fetch id data, make appropropriate gameObject, fill it, and replace temp with it.
function Inflate(givenGo:GameObject, id:String, hash:String, newChild:boolean) {
	var holder = new Hashtable[1];
	yield FetchInto(holder, hash);
	if (!holder[0]) { return; }  // FetchInto was responsible for alerting user.
	if (newChild) {
		var go = makeType(holder[0]);
		go.AddComponent(Obj);
		go.AddComponent(PictureCapture);
		Fill(go, id, holder[0]);
		// Now replace the temp with our new go.
		go.transform.parent = givenGo.transform.parent; // First, before setting the following.
		go.transform.position = givenGo.transform.position;
		go.transform.rotation = givenGo.transform.rotation;
		go.transform.localScale = givenGo.transform.localScale;
		givenGo.transform.parent = null;
		Destroy(givenGo);
		givenGo = go;
		Log('restored ' + holder[0]['nametag']);
	} else {
		Fill(givenGo, id, holder[0]);
	}
	FillVersions(givenGo, id, 'SceneReady', '');
	// Careful moving this. Timing of coroutines (and positioning of objs for Goto after restore) is subtle.
	if (!--nRemainingObjects) SceneReady();  
}
// Similar for acting on our gameObject (the whole scene), which doesn't need replacing.
// Intelligently picks the right idvtag for the requested timestamp.
// Note that FillVersions was already called first (not last as above).
function FillScene(timestamp:String) {
	nRemainingObjects++;
	var obj = gameObject.GetComponent(Obj);
	if (!timestamp) {  // Use latest available
		var stamps = obj.timestamps();
		timestamp = stamps[stamps.Count - 1];
	}
	var idvtag = obj.versions[timestamp];
	if (idvtag) { // the request was spot on
		obj.timestamp = timestamp;
	} else { // Find the version that was in place on that date...
		var keys = obj.timestamps();
		obj.timestamp = keys[0];  // ...or the oldest available;
		for (var i = 0; i < keys.Count; i++) {
			var key = keys[i];
			if (key.CompareTo(timestamp) > 0) {
				break;
			} else {
				obj.timestamp = key;
			}
		}
		idvtag = obj.versions[obj.timestamp];
	}
	var holder = new Hashtable[1];
	yield FetchInto(holder, idvtag);
	Fill(gameObject, obj.id, holder[0]);
	if (!--nRemainingObjects) SceneReady();
}	
	
// This function fills in the list of available version for an existing group.
// We need that so we can save them and have them
// not dissappear during server-side garbage collection. However, the version info
// changes from time to time, and so it must be in the general mutable data store 
// rather than the immutable (single-version) data storage. We arrange for
// the immutable data stores to include the embedded (non-top-level) current version 
// so that we don't have to look up twice, but that doesn't give us the list
// of all versions. Hence this. 
function FillVersions(x:GameObject, id:String, continuation:String, version:String) {
	var obj = x.GetComponent(Obj);
	obj.id = id;
	if (!obj.isGroup()) { return; }
	if (obj.versions) {  
		// No one else will be changing groups, so no need to refetch for latest data.
		SendMessage(continuation, version);
		return;
	}
	nRemainingObjects++;
	var www = Fetch(id);
   	yield www;
	var data:Hashtable = Parsed(www);
	if (!obj.hash) { // e.g., if a toplevel request for the latest
		obj.hash = data['idvtag'];
	}
	obj.versions = data['versions']; 
	if (!obj.versions) { // bootstrapping. synthesize some values
		obj.timestamp = GetComponent(Save).JSTime().ToString();
		obj.versions = {obj.timestamp: obj.hash};
	}
	if (!--nRemainingObjects) SendMessage(continuation, version);
}

public var materialPrototype:Material;
// Materials based on the same data must be shared. This is not only for
// memory, but also so that when a texture downloads, it updates all.
public var materialsTable = {};
// When data arrives, Inflate, above, will create the appropriate GameObject.
// This Fill takes care of common setup and the Restore (above) of each child.
function Fill(go:GameObject, id:String, data:Hashtable) {
	var obj:Obj = go.GetComponent(Obj);
	obj.id = id;
	obj.hash = data['idvtag'];
	obj.nametag = data['nametag'];
	go.name = id;
	obj.author = data['author'] || ''; 
	
	var matData:Array = data['materials'];
	if (matData != null) {
		var nMats = matData.length;
		var materials = new Material[nMats];
		for (var i = 0; i < nMats; i++) {
			var mData = matData[i];
			var mat:Material = materialsTable[mData];
			if (mat == null) {
				// FIXME: decode other properties from mData (scale, offset)
				mat = new Material(materialPrototype);
				materialsTable[mData] = mat;
				StartCoroutine( FillTexture(mat, mData) );
			}
			materials[i] = mat;
		}
		go.renderer.materials = materials;
		go.SendMessage("NewMaterials", null, SendMessageOptions.DontRequireReceiver);
	}
	var legitimateChildren = new Array(); // Keep track of the Objs we're now supposed to have.
	for (var childData:Hashtable in data['children']) {
		child = RestoreInto(childData['idtag'], childData['idvtag'], go.transform);
		legitimateChildren.Push(child.GetComponent(Obj));
		var pos = childData['position'];
		if (pos != null) child.transform.localPosition = makeVector3(pos);
		var rot = childData['rotation'];
		if (rot != null) child.transform.localRotation = makeQuaternion(rot);
		var scale = childData['scale'];
		if (scale != null) child.transform.localScale = makeVector3(scale);
	}
	// Destroy any children with Obj components that are obsolete (not legitimate).
	for (var childTransform:Transform in go.transform) {
		var comp = childTransform.gameObject.GetComponent(Obj);
		if (comp && !IsInArray(comp, legitimateChildren)) {
			// If we're about to kill the floor, set up the safetyNet again.
			if (safetyNet && (comp.nametag == 'floor')) {
				var avatars = GameObject.FindGameObjectsWithTag('Player');
				for (var avatar in avatars) { avatar.transform.position.y = 1; }
				safetyNet = GameObject.CreatePrimitive(PrimitiveType.Plane).transform;
				safetyNet.localScale = Vector3(10, 1, 10);
				safetyNet.localPosition = Vector3(0, -10, 0);
				safetyNet.name = 'SafetyNet';
				safetyNet.parent = transform;
			}
			Destroy(childTransform.gameObject);
		}
	}
}
function IsInArray(item, array:Array):boolean {
	for (x in array) if (x == item) return true;
	return false;
}

public var safetyNet:Transform;
public var destinationId = '';
function SceneReady() {
	if (safetyNet && GameObject.FindWithTag('SceneRoot').GetComponent(Obj).FindNametag('floor')) {
		Log('removing temporary floor');
		Destroy(safetyNet.gameObject); 
	}
	var target = destinationId;
	destinationId = '';
	var targetObj = target && GameObject.Find(target);
	var sceneComp = gameObject.GetComponent(Obj);
	Application.ExternalCall('sceneReady', sceneComp.nametag,
		targetObj ? targetObj.GetComponent(Obj).nametag : '',
		sceneComp.timestamp);
	if (target) { // even if not found
		var goto = Camera.main.transform.parent.GetComponent(Goto);
		Debug.Log('telling ' + goto + ' to go back to ' + targetObj);
		goto.GoBackToObj(targetObj);
	} else {
		Obj.SceneSelect(true);
	}
}

function RestoreScene(combo:String) {
	var stupidNETcharArray:char[] = ['/'[0]];
	var trio = combo.Split(stupidNETcharArray);
	var id = trio[0];
	var version = ((trio.length > 1) && trio[1]) || '';
	destinationId = ((trio.length > 2) && trio[2]) || '';
	Application.ExternalCall('notifyUser', 'RestoreScene id:' + id + ' version:' + version + ' destination:' + destinationId);
	FillVersions(gameObject, id, 'FillScene', version);
}

public var sceneId = 'G1'; // for use in editor
public var undoId = ''; // To undo to an earlier hash in editor; e.g. 
// (When cut/pasting, be sure not get extra whitespace.)
// G1//r4ATbSDF2oS2gXlJ3lrV3TU3Wv4
// G1/1368993636720/r4ATbSDF2oS2gXlJ3lrV3TU3Wv4  - penultimate
// G1/1368993677170/r4ATbSDF2oS2gXlJ3lrV3TU3Wv4  - latest
function Update() {
	if (!undoId) return;
	var id = undoId;
	undoId = ''; 
	RestoreScene(id);
}

function Awake () {
	if (!enabled) { return; }
	if (Application.isEditor) {
		RestoreScene(sceneId);
	}
}
function Start () {
	Application.ExternalCall('pluginReady', '');
}

