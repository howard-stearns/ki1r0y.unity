static function Log(s:String) {
//	Debug.Log('Restore: ' + s);  // Can be commented in/out for debugging.
}

function Fetch(id):WWW {
	return new WWW('http://' + Save.host + '/db/' + id);
	//return new WWW('file:///Users/howardstearns/Beyond-My-Wall/server/BMW/public/db/' + id);
}
// Together, these two functions handle several permutations on how we might store objects:
// {name:val0, key1:val1, ...}
// {hash:xxx} in one file, and {name:val0, key1:val1, ...} in file xxx.
function Parsed(www:WWW):Hashtable {
	var serialization = www.text;
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
	var hash:String = data['hash'];
	if (hash) { // separately stored group and object info
		www = Fetch(hash);
		Log('fetching group data ' + www.url);
		yield www;
		data = Parsed(www);
	} else {
		hash = id;
	}
	data['hash'] = hash;
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
	var url = 'http://' + Save.host + '/resources/' + id;
	Log('fetching texture ' + url + ' into ' + mat);
	var www:WWW = new WWW(url);
   	yield www;
   	mat.mainTexture = www.texture;
   	mat.mainTexture.name = id;
   	Log('retrived texture ' + id + 'into ' + mat);
}

var nRemainingObjects = 0;  // The number we have started to fetch, but which have not yet been resolved (not counting media).

// Immediately answers a visible cube that will be used by the parent as
// a stand-in of the correct position/size/rotation (because the parent has
// that info). Also starts asynchronously fetching the real data. When that
// data arrives, it will replace the cube.
function Restore(id:String, hash:String):GameObject {
	Log(id);
	nRemainingObjects++;
	var temp = GameObject.CreatePrimitive(PrimitiveType.Cube);
	StartCoroutine( Inflate(temp, id, hash) );
	return temp;
}
// Coroutine to fetch id data, make appropropriate gameObject, fill it, and replace temp with it.
function Inflate(temp:GameObject, id:String, hash:String) {
	var holder = new Hashtable[1];
	yield FetchInto(holder, hash || id);
	var go = makeType(holder[0]);
	Fill(go, id, holder[0]);
	// Now replace the temp with our new go.
	go.transform.parent = temp.transform.parent; // First, before setting the following.
	go.transform.position = temp.transform.position;
	go.transform.rotation = temp.transform.rotation;
	go.transform.localScale = temp.transform.localScale;
	temp.transform.parent = null;
	Destroy(temp);
	Log('restored ' + holder[0]['name']);
	// Careful moving this. Timing of coroutines (and positioning of objs for Goto after restore) is subtle.
	if (!--nRemainingObjects) SceneReady();  
}
// Similar for acting on our gameObject (the whole scene), which doesn't need replacing, but does need the SafetyNet removed.
function FillScene(id:String, label:String) {
	nRemainingObjects = 1;
	var holder = new Hashtable[1];
	yield FetchInto(holder, id);
	Fill(gameObject, label, holder[0]);
	if (!--nRemainingObjects) SceneReady();
}

public var materialPrototype:Material;
// Materials based on the same data must be shared. This is not only for
// memory, but also so that when a texture downloads, it updates all.
public var materialsTable = {};
// When data arrives, Inflate, above, will create the appropriate GameObject.
// This Fill takes care of common setup and the Restore (above) of each child.
function Fill(go:GameObject, id:String, data:Hashtable) {
	var obj:Obj = go.AddComponent(Obj);
	obj.id = id;
	obj.hash = data['hash'];
	obj.nametag = data['name'];
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
	for (var childData:Hashtable in data['children']) {
		var child = Restore(childData['id'], childData['hash']);  
		// At this point, both go and child are at top level, with no parent transform
		child.transform.parent = go.transform;
		var pos = childData['position'];
		if (pos != null) child.transform.localPosition = makeVector3(pos);
		var rot = childData['rotation'];
		if (rot != null) child.transform.localRotation = makeQuaternion(rot);
		var scale = childData['scale'];
		if (scale != null) child.transform.localScale = makeVector3(scale);
	}
}

public var safetyNet:Transform;
public var destinationId = '';
function SceneReady() {
	if (GameObject.FindWithTag('SceneRoot').GetComponent(Obj).FindNametag('floor') != null) {
		Log('removing temporary floor');
		Destroy(safetyNet.gameObject); 
	}
	var target = destinationId && GameObject.Find(destinationId);
	Application.ExternalCall('sceneReady', GetComponent(Obj).nametag);
	if (target) Camera.main.transform.parent.GetComponent(Goto).Goto(target.transform, false);
	else Obj.SceneSelect(true);
}

function RestoreScene(combo:String) {
	var stupidNETcharArray:char[] = ['/'[0]];
	var pair = combo.Split(stupidNETcharArray);
	var id = pair[0];
	destinationId = pair[1];
	Application.ExternalCall('notifyUser', 'restoring ' + combo + ', id ' + id + ', destination ' + destinationId);
	FillScene(id, id);
}
function ReRestoreScene(id:String) {
	// Raise avatars up to the entry height so that they don't fall.
	var avatars = GameObject.FindGameObjectsWithTag('Player');
	for (var avatar in avatars) {
		avatar.transform.position.y = 1;
	}
	// Remove existing children, working backwards so we can iterate properly.
	for (var i=transform.childCount-1; i>=0; --i) {
		Destroy(transform.GetChild(i).gameObject);
	}
	// Replace safetyNet
	safetyNet = GameObject.CreatePrimitive(PrimitiveType.Plane).transform;
	safetyNet.localScale = Vector3(10, 1, 10);
	safetyNet.localPosition = Vector3(0, -10, 0);
	safetyNet.name = 'SafetyNet';
	safetyNet.parent = transform;
	// And finally do the restoration...
	FillScene(id, name);
}

public var sceneId = 'G1'; // for use in editor
public var undoId = ''; // To undo to an earlier hash in editor; e.g. 5682b2a56a08a4514309fed3ba64e274f0ac8c43
function Update() {
	if (!undoId) return;
	var id = undoId;
	undoId = ''; 
	ReRestoreScene(id);
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

