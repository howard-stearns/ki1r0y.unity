static function Log(s:String) {
	//Debug.Log('Restore: ' + s);  // Can be commented in/out for debugging.
}

// Turn on or off normal avatar stuff such as whether moving platform is enabled (which can get really weird during restoration).
function avatarActions(on:boolean) {
	var avatars = GameObject.FindGameObjectsWithTag('Player');
	for (var avatar in avatars) { avatar.GetComponent.<CharacterMotor>().movingPlatform.enabled = on; }
}

function Fetch(id:String, mode:String):WWW {
	var url = 'http://' + Save.host + '/' + mode + '/' + id;
	Log('fetching ' + url);
	return new WWW(url);
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
function CoFetchObjectData(holder:Hashtable[], id:String) {
	var www = Fetch(id, 'thing');;
   	yield www;
	var data:Hashtable = Parsed(www);
	if (!data) { return; }
	var hash:String = data['idvtag'];
	if (hash) { // separately stored group and object info
		www = Fetch(hash, 'thing');
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

var nRemainingObjects = 0;  // The number we have started to fetch, but which have not yet been resolved (not counting media).
// Immediately answers a (possibly new) child of parent, and starts asynchronously 
// fetching the real data. If id does not already name a child, then create a 
// visible cube that will be used as a stand-in of the correct position/size/rotation
// (because the parent has that info). When the data arrives, it will replace the cube.
function RestoreChild(id:String, hash:String, parent:Transform) {
	hash = hash || id;
	var child = parent.Find(id);
	var newChild = !child;
	if (newChild) {
		child = GameObject.CreatePrimitive(PrimitiveType.Cube).transform;
		child.gameObject.AddComponent(Obj);
		child.parent = parent;
	} else {  // if hash is already right, we're done.
		var obj = child.GetComponent.<Obj>();
		if (obj && (obj.hash == hash)) return child.gameObject;
	}
	nRemainingObjects++;
	StartCoroutine( CoInflate(child.gameObject, id, hash, newChild) );
	return child.gameObject;
}
public var blockPrototype:Transform;  // Our 6-textured block
public var flatPrototype:Transform;
public var meshPrototype:Transform;
public var lightPrototype:Transform;
// Coroutine to fetch id data and either use it to fill the existing object, 
// or replace the temporary existing object with a correctly filled new object.
function CoInflate(existing:GameObject, id:String, hash:String, newChild:boolean) {
	var dataHolder = new Hashtable[1];
	yield CoFetchObjectData(dataHolder, hash);
	var data = dataHolder[0];
	if (!data) { return; }  // CoFetchObjectData was responsible for alerting user.
	if (newChild) {
		var proto:Transform;
		switch (data['type']) {
		case 'Plane': proto = flatPrototype; break;
		case 'Cube': proto = blockPrototype; break;
		case 'Mesh': proto = meshPrototype; break;
		case 'Directional':
		case 'Spot':
		case 'Point': proto = lightPrototype; break;
		}
		var go = Instantiate(proto.gameObject);
		var obj = go.GetComponent.<Obj>();	
		obj.kind = data['type'];
		yield CoFill(go, id, data);
		// Now replace the temp with our new go.
		go.transform.parent = existing.transform.parent; // First, before setting the following.
		go.transform.position = existing.transform.position;
		go.transform.rotation = existing.transform.rotation;
		obj.size(existing.GetComponent.<Obj>().size());
		existing.transform.parent = null;
		Destroy(existing);
		existing = go;
		Log('restored ' + data['nametag']);
	} else {
		yield CoFill(existing, id, data);
	}
	StartCoroutine( CoFillVersions(existing, id, 'SceneReady', '') ); // If this is a group, fill in versions so they don't get lost on save.
	// Careful moving this. Timing of coroutines (and positioning of objs for Goto after restore) is subtle.
	if (!--nRemainingObjects) SceneReady();  
}
// Similar for acting on our gameObject (the whole scene), which doesn't need replacing.
// Intelligently picks the right idvtag for the requested timestamp.
// Note that CoFillVersions was already called first (not last as above).
function CoFillScene(timestamp:String) {
	nRemainingObjects++;
	var obj = gameObject.GetComponent.<Obj>();
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
	yield CoFetchObjectData(holder, idvtag);
	yield CoFill(gameObject, obj.id, holder[0]);
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
function CoFillVersions(x:GameObject, id:String, continuation:String, version:String) {
	var obj = x.GetComponent.<Obj>();
	obj.id = id;
	if (!obj.isGroup()) { return; }
	if (obj.versions) {  
		// No one else will be changing groups, so no need to refetch for latest data.
		if (!nRemainingObjects) SendMessage(continuation, version); // No -- because we didn't ++.
		return;
	}
	nRemainingObjects++;
	var www = Fetch(id, 'place');
   	yield www;
	var data:Hashtable = Parsed(www);
	if (!obj.hash) { // e.g., if a toplevel request for the latest
		obj.hash = data['idvtag'];
	}
	obj.versions = data['versions']; 
	if (!obj.versions) { // bootstrapping. synthesize some values
		obj.timestamp = GetComponent.<Save>().JSTime().ToString();
		obj.versions = {obj.timestamp: obj.hash};
	}
	if (!--nRemainingObjects) SendMessage(continuation, version);
}

public var materialPrototype:Material;
// Materials based on the same data must be shared. This is not only for
// memory, but also so that when a texture downloads, it updates all.
public var materialsTable = {};
public var safetyNetPrototype:Transform;
// When data arrives, CoInflate, above, will create the appropriate GameObject.
// This CoFill takes care of common setup and the Restore (above) of each child.
// It is a coroutine that waits for any necessary media (except materials), because go might be an original being refreshed.
// (If go is an original rather than a temp, we're relying on the kind not changing.)
function CoFill(go:GameObject, id:String, data:Hashtable):IEnumerator {
	var obj:Obj = go.GetComponent.<Obj>();
	obj.id = id;
	obj.hash = data['idvtag'];
	obj.nametag = data['nametag'];
	go.name = id;
	obj.author = data['author'] || ''; 
	// Now any type-specific initialization:
	switch (obj.kind) {
	case 'Directional':
	case 'Spot':
	case 'Point': 
		var light = go.GetComponent.<Light>();
		light.type = System.Enum.Parse( typeof( LightType ), data['type'] );
		light.intensity = data['intensity'];
		break;
	case 'Mesh':
		// Should we go through ResourceLoader?
		var objMesh = obj.mesh.GetComponent.<ObjMesh>();
		yield objMesh.Load('http://' + Save.host + '/media/' + data['mesh']); // Don't replace existing until we have the replacement. It's ok, we'll wait.
		break;
	}

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
				StartCoroutine( ResourceLoader.instance.FetchTexture('http://' + Save.host + '/media/' + mData, mData, mat) );
			}
			materials[i] = mat;
		}
		obj.sharedMaterials(materials);
	}
	var legitimateChildren = new Array(); // Keep track of the Objs we're now supposed to have.
	for (var childData:Hashtable in data['children']) {
		// Immediately defines a child, but also starts a coroutine to fetch that child's data.
		child = RestoreChild(childData['idtag'], childData['idvtag'], go.transform);
		var childObj = child.GetComponent.<Obj>();
		legitimateChildren.Push(childObj);
		var pos = childData['position'];
		if (pos != null) child.transform.localPosition = makeVector3(pos);
		var rot = childData['rotation'];
		if (rot != null) child.transform.localRotation = makeQuaternion(rot);
		var scale = childData['scale'];  // obsolete
		if (scale != null) child.transform.localScale = makeVector3(scale);
		var size = childData['size'];
		if (size != null) childObj.size(makeVector3(size));
	}
	// Destroy any children with Obj components that are obsolete (not legitimate).
	for (var childTransform:Transform in go.transform) {
		var comp = childTransform.gameObject.GetComponent.<Obj>();
		if (comp && (child.transform.tag == 'SafetyNet') && !IsInArray(comp, legitimateChildren)) {
			// If we're about to kill the floor, set up the safetyNet again.
			if (safetyNet && (comp.nametag == 'floor')) {
				Log('creating safetyNet');
				var avatars = GameObject.FindGameObjectsWithTag('Player');
				for (var avatar in avatars) { avatar.transform.position.y = 1; }
				safetyNet = Instantiate(safetyNetPrototype.gameObject).transform;
				safetyNet.parent = transform;
			}
			Log('destroying obsolete ' + childTransform);
			childTransform.parent = null;
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
	if (safetyNet && GameObject.FindWithTag('SceneRoot').GetComponent.<Obj>().FindNametag('floor')) {
		Log('removing temporary floor');
		safetyNet.parent = null;
		Destroy(safetyNet.gameObject);
		safetyNet = null; 
	}
	avatarActions(true);
	var target = destinationId;
	destinationId = '';
	var targetObj:GameObject = target ? GameObject.Find(target) : null;
	var sceneComp = gameObject.GetComponent.<Obj>();
	Application.ExternalCall('sceneReady', sceneComp.nametag,
		targetObj ? targetObj.GetComponent(Obj).nametag : '',
		sceneComp.timestamp,
		sceneComp.hash);
	//if (target) { // even if not found  // FIXME: remove if this works out
		var goto = Camera.main.transform.parent.GetComponent.<Goto>();
		goto.GoBackToObj(targetObj ? targetObj : null);  // FIXME scene gameObject is probably not the right thing on undo!
	//} else {
	//	Obj.SceneSelect(true);
	//}
}

function RestoreScene(combo:String) {
	var trio = Save.splitPath(combo);
	var id = trio[0];
	var version = ((trio.length > 1) && trio[1]) || '';
	destinationId = ((trio.length > 2) && trio[2]) || '';
	Application.ExternalCall('notifyUser', 'RestoreScene id:' + id + ' version:' + version + ' destination:' + destinationId);
	avatarActions(false);
	var existing = gameObject.GetComponent.<Obj>();
	existing.versions = null; // Clear out cache so that CoFillVersions doesn't optimize away the fetch.
	// This is a bit of a pun. After resotoration, we will GoBackToObj, which will tell the browser to select through one of
	// two paths. The path through Obj.SceneSelect will not act if Obj.selectedId is falsey. On startup, existing.id
	// will indeed be falsey (which will suppress scene selection as desired), but if we go here while already in-scene,
	// the existing.id will be truthy and we'll get a new scene selection as desired. (That's a lot of comment for one assignment!)
	Obj.selectedId = existing.id;
	StartCoroutine( CoFillVersions(gameObject, id, 'CoFillScene', version) );
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

