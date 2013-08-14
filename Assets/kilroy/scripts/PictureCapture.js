// Ensure that the gameObject has a recent thumbnail uploaded for id and 
// optionally for secondaryId.
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
// FIXME: If we go into production without the above, we should change this to
// upload once, with the server taking care of the second copy.
//
// FIXME: BUG: This only has provision for a secondaryId (the scene), but in fact, all the
// objects in the path between id and the scene will be changed, and need pictures.
//
// In any case, this function is always a coroutine, because the upload will 
// certainly be asynchronous.
function Thumbnail (id:String, secondaryId:String) {
    // We should only read the screen after all rendering is complete
    yield WaitForEndOfFrame();
    // The picture will be our Unity screen size (e.g., currently 600x450 px). 
    // Facebook is variously said to require 50 min, 200 min preferred,
    // 400 min in forum discussions, 1500 preferred, 3:1 maximum aspect ratio,
    // 5MB max size.
    var width = Screen.width;
    var height = Screen.height;
    var tex = new Texture2D( width, height, TextureFormat.RGB24, false );
    // Read screen contents into the texture
    tex.ReadPixels( Rect(0, 0, width, height), 0, 0 );
    tex.Apply();
    // Encode texture into PNG
    var bytes = tex.EncodeToPNG();
    Destroy( tex );
 	yield upload(bytes, id);
 	if (!String.IsNullOrEmpty(secondaryId)) upload(bytes, secondaryId);
}

private function upload(bytes:byte[], id:String) {
   	// Create a Web Form
    var form = new WWWForm();
    // FIXME remove form.AddField("frameCount", Time.frameCount.ToString());
    form.AddBinaryData("fileUpload", bytes, "screenShot.png", "image/png");
    // Upload to id
    var www = WWW('http://' + Save.host + '/thumb/' + id, form);
    yield www;
    if (!String.IsNullOrEmpty(www.error))
    	Application.ExternalCall('errorMessage', 'Thumbnail ' + id + ' failed:' + www.error);
}