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
function Log(s:String) {
	//Debug.Log('Restore: ' + s);
}

function makeVector3(data:Hashtable):Vector3 {
	return Vector3(data['x'], data['y'], data['z']);
}
function makeQuaternion(data:Hashtable):Quaternion {
	return Quaternion(data['x'], data['y'], data['z'], data['w']);
}

function Restore(id:String):GameObject {
	Log(id);
	var temp = GameObject.CreatePrimitive(PrimitiveType.Cube);
	Inflate(temp, id);
	return temp;
}

function Fill(go:GameObject, id:String, data:Hashtable) {
	go.AddComponent(Obj).id = id;
	go.name = data['name'];
	for (var childData:Hashtable in data['children']) {
		var child = Restore(childData['id']);  
		// At this point, both go and child are at top level, with no parent transform
		var pos = childData['position'];
		if (pos != null) child.transform.localPosition = makeVector3(pos);
		var rot = childData['rotation'];
		if (rot != null) child.transform.localRotation = makeQuaternion(rot);
		var scale = childData['scale'];
		if (scale != null) child.transform.localScale = makeVector3(scale);
		child.transform.parent = go.transform;
	}
}
function Fetch(id):WWW {
	return new WWW('http://beyondmywall.fe100.net/db/' + id);
	//return new WWW('file:///Users/howardstearns/Beyond-My-Wall/server/BMW/public/db/' + id);
}
function Parsed(www:WWW):Hashtable {
	var serialization = www.text;
	return JSON.Parse(serialization);
	// return db[id]; // simulation of server fetch
}


function Inflate(temp:GameObject, id:String) {
	var www = Fetch(id);
   	yield www;
	var data:Hashtable = Parsed(www);
	//Log('Inflating ' + data['name'] + ' into ' + id);
	var go:GameObject;
	var type:String = data['type'];
	var pt:Object = null;
	if (type == 'Plane') pt = PrimitiveType.Plane;
	else if (type == 'Cube') pt = PrimitiveType.Cube;
	else if (type == 'Sphere') pt = PrimitiveType.Sphere;
	if (pt != null) go = GameObject.CreatePrimitive(pt);
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
	go.transform.position = temp.transform.position;
	go.transform.rotation = temp.transform.rotation;
	go.transform.localScale = temp.transform.localScale;
	go.transform.parent = temp.transform.parent;
	temp.transform.parent = null;
	Destroy(temp);
	Log('restored ' + data['name']);
}

public var safetyNet:Transform;
function KillFloor():IEnumerator {
	// How do we know when it's time to kill the temporaryFloor?
	// For now, it is when we have an object named 'floor';
	if (GameObject.Find('floor')) {
		Log('removing temporary floor');
		Destroy(safetyNet.gameObject);
	} else {
		//Log('No floor yet');
		yield WaitForSeconds(0.5);
		KillFloor();
	}
}

function RestoreScene(id:String) {
	var www = Fetch(id);
   	yield www;
	var data:Hashtable = Parsed(www);
	Fill(gameObject, id, data);
	KillFloor();
}

public var sceneId:String = '21697b1b5dea23c59dcf00e3e7e65b572bed68e5';
function Awake () {
	//if (Application.isEditor) 
		RestoreScene(sceneId);
}

