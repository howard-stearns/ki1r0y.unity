// Turns off mouse look when the mouse leaves the player.
// Currently, this script is expected to be attached to a GUITexture that covers the player, but which has no texture, 
// and has a child GUITexture with a crosshair. But we don't actually use the parent GUITexture right now.

	// Set of MouseLook scripts to be (dis-)enabled. FIXME: just OUR avatar's MouseLooks!
public var looks:MouseLook[];  
private var crosshair:GUITexture;

private static function setScreenLock(enabled:boolean):void {
	if (enabled) { 
		Cursor.lockState = CursorLockMode.Locked; 
		Cursor.visible = false; 
	} else {
		Cursor.lockState = CursorLockMode.None; 
		Cursor.visible = true; 
	}
}
private static function getScreenLock():boolean {
	return Cursor.lockState == CursorLockMode.Locked;
}

// IFF enabled, we use cursor locking with MouseLook, and display our own crosshairs.
// UI requirement: any gesture that does this must (in itself or some path to get to it) require a click within the window. 
// Otherwise programmatic trackMouseMotion(true) (e.g., on driving) will not work in browser.
private function trackMouseMotion(enabled:boolean) {
	//if (enabled) lock = false;
	for (var script:MouseLook in looks) script.enabled = enabled;
	// When (and only when) we allow head/camera movement to follow the mouse, use Minecraft-style cursor lock and show a crosshair.
	setScreenLock(enabled);
	crosshair.enabled = enabled;
	
	//var s = 'mouse look:' + enabled + ' lockCursor:' + Screen.lockCursor + ' crosshair:' + crosshair.enabled + ' @' + Time.time + ' fixed:' + Time.fixedTime;
	//Application.ExternalCall('notifyUser', s);
}

function Start() { // set up expected state regardless of environment.
	crosshair = transform.Find('crosshair').GetComponent.<GUITexture>();
	if (Application.isEditor) crosshair.pixelInset.y = -15; // because the editor is weird
	//Debug.Log('OverlayControls Screen.lockCursor was ' + Screen.lockCursor);
	// In editor and stand-alone we could start off with screen locked, but that is not allowed in a browser, so let's always do that.
	trackMouseMotion(false);
}
// The editor and Web plugin will automatically clear Screen.lockCursor for us when the user presses escape or switches to another application.
// However, it won't call trackMouseMotion for us, so we have to track things independently and call it ourself.
private var wasLocked = false;
function Update () {
	if (Input.GetKeyDown(KeyCode.F11) || (Input.GetKeyDown(KeyCode.F) && Input.GetKey(KeyCode.LeftCommand))) {
		Debug.Log("toggle full screen from " + Screen.fullScreen);
		Screen.fullScreen = !Screen.fullScreen;
	}
	// In standalone player we have to provide our own key input for unlocking the cursor
	if (Input.GetKeyDown(KeyCode.Escape)) setScreenLock(false);
	if (!getScreenLock() && wasLocked) {
		wasLocked = false;
		trackMouseMotion(false);
	} else if (getScreenLock() && !wasLocked) {
		wasLocked = true;
		trackMouseMotion(true);
	}
}
// When the mouse exits the scene and then someone clicks back on the scene, we need to wait several frames before doing at-object actions such as tiling:
// Our first LateUpdate frame will be BEFORE we get the Sticky StartDragging and StopDragging.
// The third is after the StopDragging, where we can safely allow such actions.
public static var BlockActionFrames = 0; // If truthy, the mouse has exited the scene and we don't yet consider the user to have clicked back.
// Public interface to request that we track mouse motion or not.
public static function TrackMouseMotion(enabled:boolean) { 
	// We do not trackMouseMotion directly, but rather attempt to set this flag and let Update keep things consistent.
	setScreenLock(enabled); // and then let the Update do the rest.
	// If we fail to set the flag (e.g., because the user has left the application and not yet clicked back in),
	// then we notify the user -- once -- until we're once again consistent.
	if (getScreenLock() == enabled) { // Everything in sync...
		NeedsNotice = true; // ...reset for next discrepency
	} else {
		if (NeedsNotice) { // don't flood messages
			var msg = "Click in scene to unlock camera for free motion.";
			Debug.LogWarning(msg);
			Application.ExternalCall('advice', msg);
			NeedsNotice = false;
		}
	}
}
function OnMouseExit () { 
	//Debug.LogWarning('exit');
	BlockActionFrames = -1;
}
function OnMouseUp () { 
	//Debug.LogWarning('click ' + BlockActionFrames);
	if (BlockActionFrames < 0) { BlockActionFrames = 1; }
}
function LateUpdate() {
	if (BlockActionFrames > 0) { 
		//Debug.LogWarning('clear exit ' + BlockActionFrames);
		BlockActionFrames--;
	}
}