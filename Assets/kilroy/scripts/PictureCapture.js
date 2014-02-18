// Capture the scene from the current camera. callback is a message to send with bytes.
function SceneCapture(callback:String, scale:float):IEnumerator {
	// While we take the picture, make sure that there is no gizmo in the way, and restore it later.
	var avatarSelect = Interactor.Avatar().GetComponent.<Select>();
	var runningGizmo = avatarSelect.StopGizmo();
    // We should only read the screen after all rendering is complete
    yield WaitForEndOfFrame();
    // The picture will be our Unity screen size (e.g., currently 600x450 px). 
    // Facebook is variously said to require 50 min, 200 min preferred,
    // 400 min in forum discussions, 1500 preferred, 3:1 maximum aspect ratio,
    // 5MB max size.
    // TODO: measure timing of uploading this size vs first using TextureScale to downsample.
    var width = Screen.width;
    var height = Screen.height;
    var tex = new Texture2D( width, height, TextureFormat.RGB24, false );
    // Read screen contents into the texture
    tex.ReadPixels( Rect(0, 0, width, height), 0, 0 );
    tex.Apply();
    if (scale != 1.0) { Application.ExternalCall('notifyUser', 'rescaling thumbnail'); TextureScale.Bilinear(tex, scale * Screen.width, scale * Screen.height); }
    if (runningGizmo != null) { avatarSelect.StartGizmo(runningGizmo); }
    // Encode texture into PNG
    var bytes = tex.EncodeToPNG();
    Application.ExternalCall('notifyUser', 'texture ' + scale + ' ' + tex.width + 'x' + tex.height + ' png bytes=' + bytes.Length);
    Destroy( tex );
	SendMessage(callback, bytes);
}
function updateBrowserBackgroundImage(bytes:byte[]) {
	var base64 = System.Convert.ToBase64String(bytes);
	Application.ExternalCall('notifyUser', 'image is ' + bytes.Length + ' sending ' + base64.Length);
	Application.ExternalCall('updateBackgroundImage', 'data:image/jpeg;base64,' + base64);
}
function captureSceneToBackground(scale:String) {
	SceneCapture('updateBrowserBackgroundImage', float.Parse(scale));
}

// Ensure that the gameObject has a recent thumbnail uploaded for all ids.
//
// When we get UnityPro, this should use RenderTexture to take a picture 
// from a camera at the object's standard cammera position (see Goto 
// cameraEndPos/Rot). Until then, however, we'll have to make do with the
// screen renderer.
//
// When we have a separate thumbnail camera, we can have this defer capture
// until convenient (e.g., until there has been no user activity for two beats).
// Until then, we'll have to make do with having this be immediate so that the 
// user's avatar camera hasn't driven off to somewhere else.
//
// Note that our obj.id might or might not be in the ids for which this thumbnail is saved.
// For example, an object gets a new thumbnail only when the object (and it's id) actually change.
// But when an object is merely moved, all the ancestors of the object do get a new id and a new thumbnail,
// with a picture of the object that caused the change.
//
// In any case, this function is always a coroutine, because the upload will 
// certainly be asynchronous.
var pendingIds:Array;
function Thumbnail(ids:Array):IEnumerator {
	pendingIds = ids;
	yield SceneCapture('uploadThumbnail', 1.0);
}
function uploadThumbnail(bytes:byte[]) {
	var ids = pendingIds;      	
    var id = ids.Pop();
    // Create a Web Form
    var form = new WWWForm();
    form.AddBinaryData('fileUpload', bytes, 'screenShot.png', 'image/png');
    if (ids.length) { form.AddField('additionalIds', JSON.Stringify(ids)); }
    // Upload to id
    var www = WWW('http://' + Save.host + '/thumb/' + id, form);
    //Debug.Log('uploading ' + www.url);
    yield www;
    if (!String.IsNullOrEmpty(www.error))
    	Application.ExternalCall('errorMessage', 'Thumbnail ' + id + ' failed:' + www.error);
}
function updateThumbnail() { Thumbnail([gameObject.GetComponent.<Obj>().hash]); } // From browser
