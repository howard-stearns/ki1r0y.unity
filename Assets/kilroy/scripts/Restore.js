/* Todo:
	Real save, as needed.
	Real db.
	Textures.
	Make code more data-driven.
	What to do about change history, GC?
 */
	

public var db = 
{
"24faf820e829988a6b831d15ec4c25220bc7971e": '{"name" : "backWall","type" : "Plane"}',
"d307898c060a157923211768ee1c09da6b07b00c": '{"name" : "Directional light", "type" : "Directional", "intensity" : 0.5}',
"441c5fb6468a649eaa83db1dc3d09d8b67077b0e": '{"name" : "floor","type" : "Plane"}',
"e85b09aa48f25c0e0436729f3334a29dcf343cd8": '{"name" : "leftWall","type" : "Plane"}',
"d5c9358048b484a083423e09d5bc3f32ada45622": '{"name" : "rotatedCube","type" : "Cube"}',
"665c7030bab074f9f6a455003eda1f40b4b72009": '{"name" : "Sphere","type" : "Sphere"}',
"da25a18cd08161823d3bcb1e295bf8ae843db65f": '{"name" : "tallCube","type" : "Cube"}',
"419d57d1fc5657815cd997fc566910e62a9830f9": 
 '{"children" : [{"id" : "24faf820e829988a6b831d15ec4c25220bc7971e","position" : {"x" : 8.450162,"y" : -0.0377996,"z" : 4.243648},"rotation" : {"w" : 0.7071067,"x" : 0,"y" : 0,"z" : 0.7071068}},{"id" : "d307898c060a157923211768ee1c09da6b07b00c","position" : {"x" : 2.200287,"y" : 0.6813452,"z" : 2.953255},"rotation" : {"w" : 0.9116248,"x" : 0.08803673,"y" : 0.2966023,"z" : -0.2705861}},{"id" : "441c5fb6468a649eaa83db1dc3d09d8b67077b0e","position" : {"x" : 3.470267,"y" : -2.294606,"z" : 4.272788}},{"id" : "e85b09aa48f25c0e0436729f3334a29dcf343cd8","position" : {"x" : 3.488311,"y" : -0.9996749,"z" : 9.101078},"rotation" : {"w" : 0.7071067,"x" : -0.7071068,"y" : 0,"z" : 0}},{"id" : "d5c9358048b484a083423e09d5bc3f32ada45622","position" : {"x" : 5.909942,"y" : -1.832091,"z" : 3.089984},"rotation" : {"w" : 0.9008605,"x" : 0,"y" : -0.4341087,"z" : 0}},{"id" : "665c7030bab074f9f6a455003eda1f40b4b72009","position" : {"x" : 0.9262815,"y" : -1.153377,"z" : 5.923676},"scale" : {"x" : 2,"y" : 2,"z" : 2}},{"id" : "da25a18cd08161823d3bcb1e295bf8ae843db65f","position" : {"x" : 3.50061,"y" : -1.294861,"z" : 4.245239},"scale" : {"x" : 1,"y" : 2,"z" : 1}}],"name" : "TestStage"}'
};
public var host:String;
function Log(s:String) {
	//Debug.Log('Restore: ' + s);
}

function makeVector3(data:Hashtable):Vector3 {
	return Vector3(data['x'], data['y'], data['z']);
}
function makeQuaternion(data:Hashtable):Quaternion {
	return Quaternion(data['x'], data['y'], data['z'], data['w']);
}

function FillTexture(mat:Material, id:String) {
	// TODO: WWW in Unity editor is certainly not caching, despite Cache-Control/Expires.
	// See if the browser plugin and standalone is as bad.
	// See http://unity3d.com/webplayer_setup/setup-3.x/
	var url = host + '/resources/' + id;
	Log('fetching ' + url + ' into ' + mat);
	var www:WWW = new WWW(url);
   	yield www;
   	mat.mainTexture = www.texture;
   	mat.mainTexture.name = id;
   	Log('retrived ' + id + 'into ' + mat);
}

// Immediately answers a visible cube that will be used by the parent as
// a stand-in of the correct position/size/rotation (because the parent has
// that info). Also starts asynchronously fetching the real data. When that
// data arrives, it will replace the cube.
function Restore(id:String):GameObject {
	Log(id);
	var temp = GameObject.CreatePrimitive(PrimitiveType.Cube);
	Inflate(temp, id);
	return temp;
}

public var materialPrototype:Material;
// Materials based on the same data must be shared. This is not only for
// memory, but also so that when a texture downloads, it updates all.
public var materialsTable = {};

// When data arrives, Inflate, below, will create the appropriate GameObject.
// This Fill takes care of common setup and the Restore (above) of each child.
function Fill(go:GameObject, id:String, data:Hashtable) {
	var obj:Obj = go.AddComponent(Obj);
	obj.id = id;
	if (obj.isGroup()) obj.hash = data.hash; // Which might not be in the data. 
	else obj.hash = id;
	// FIXME remove go.name = data['name'];
	obj.nametag = data['name'];
	go.name = id;
	
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
				FillTexture(mat, mData);
			}
			materials[i] = mat;
		}
		go.renderer.materials = materials;
		go.SendMessage("NewMaterials", null, SendMessageOptions.DontRequireReceiver);
	}
	for (var childData:Hashtable in data['children']) {
		var child = Restore(childData['id']);  
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
function Fetch(id):WWW {
	return new WWW(host + '/db/' + id);
	//return new WWW('file:///Users/howardstearns/Beyond-My-Wall/server/BMW/public/db/' + id);
}
function Parsed(www:WWW):Hashtable {
	var serialization = www.text;
	var data = JSON.Parse(serialization);
	// Handle the case of groups, in which data can be {data: dataWithoutHash, hash: hash}
	if (data['hash']) {
		var realData = data['data'];
		realData['hash'] = data['hash'];
		data = realData;
	}
	return data;
	// return db[id]; // simulation of server fetch
}

public var blockPrototype:Transform;
function Inflate(temp:GameObject, id:String) {
	var www = Fetch(id);
	Log('fetching ' + www.url);
   	yield www;
	var data:Hashtable = Parsed(www);
	//Log('Inflating ' + data['name'] + ' into ' + id);
	var go:GameObject;
	var type:String = data['type'];
	var pt:Object = null;
	if (type == 'Plane') pt = PrimitiveType.Plane;
	//else if (type == 'Cube') pt = PrimitiveType.Cube;
	else if (type == 'Sphere') pt = PrimitiveType.Sphere;
	if (pt != null) go = GameObject.CreatePrimitive(pt);
	else if (type == 'Cube') go = Instantiate(blockPrototype.gameObject);
	else {
		go = new GameObject();
		if (type == 'Directional') pt = LightType.Directional;
		else if (type == 'Point') pt = LightType.Point;
		else if (type === 'Spot') pt = LightType.Spot;
		if (pt != null) {
			var light = go.AddComponent(Light);
			light.type = pt;
			light.intensity = data['intensity'];
		} 
	}
	Fill(go, id, data);
	// Now replace the temp with our new go.
	go.transform.parent = temp.transform.parent; // First, before setting the following.
	go.transform.position = temp.transform.position;
	go.transform.rotation = temp.transform.rotation;
	go.transform.localScale = temp.transform.localScale;
	temp.transform.parent = null;
	Destroy(temp);
	Log('restored ' + data['name']);
}

public var safetyNet:Transform;
function KillFloor():IEnumerator {
	// How do we know when it's time to kill the temporaryFloor?
	// For now, it is when we have an object named 'floor';
	if (GameObject.FindWithTag('SceneRoot').GetComponent(Obj).FindNametag('floor') != null) { // FIXME remove GameObject.Find('floor')) {
		Log('removing temporary floor');
		Destroy(safetyNet.gameObject);
	} else {
		//Log('No floor yet');
		yield WaitForSeconds(0.5);
		KillFloor();
	}
}
function FindObj(obj:Transform, id:String):boolean {
	var comp = obj.GetComponent(Obj);
	if ((comp != null) && (comp.id == id)) {
		Camera.main.transform.parent.GetComponent(Goto).Goto(obj);
		return true;
	}
	for (var child in obj) {
		if (FindObj(child, id)) return true;
	}
	return false;
}
function GotoObj(objId:String):IEnumerator {
	if (FindObj(transform, objId)) return;
	yield WaitForSeconds(0.5);
	GotoObj(objId);
}

function RestoreScene(combo:String) {
	var stupidNETcharArray:char[] = [':'[0]];
	var pair = combo.Split(stupidNETcharArray);
	var id = pair[0]; var objId = pair[1];
	Application.ExternalCall('notifyUser', 'restoring ' + id);
	var www = Fetch(id);
   	yield www;
	var data:Hashtable = Parsed(www);
	Fill(gameObject, id, data);
	KillFloor();
	if (objId && (objId != id)) GotoObj(objId);
	else Obj.SceneSelect(true);
	Application.ExternalCall('sceneReady', GetComponent(Obj).nametag);
}

public var sceneId:String = '21697b1b5dea23c59dcf00e3e7e65b572bed68e5';
function Awake () {
	if (!enabled) { return; }
	if (Application.isEditor) {
		host = 'http://localhost:3000'; // Doesn't depend on external DNS
		RestoreScene(sceneId + ':' + sceneId);
	} else {
		host = 'http://beyondmywall.fe100.net';
	}
}
function Start () {
	Application.ExternalCall('pluginReady', '');
}

