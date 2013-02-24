// Turns off mouse look when the mouse leaves the player.
// Attach this script to a GUITexture that covers the player, but which has no texture.

	// Set of MouseLook scripts to be (dis-)enabled. FIXME: just OUR avatar's MouseLooks!
public var looks:MouseLook[];  
public var lock = false;
function trackMouseMotion(enabled:boolean) {
	if (enabled) lock = false;
	for (var script:MouseLook in looks) script.enabled = enabled;
}

// So that neither clicking nor re-entering overlay will not turn mouse look back on.
function lockMouseMotionOff() { 
	lock = true;
	trackMouseMotion(false);
}

// Note that iPhone doesn't have OnMouse<mumble>.
// Enable mouse look when the mouse enters the player (e.g., from off screen), unless locked.
function OnMouseEnter() { if (lock) return; trackMouseMotion(true); }
// Enable mouse look when we click anywhere in the player, unless locked.
function OnMouseDown() { if (lock) return; trackMouseMotion(true); }

// Keep track of each mouse motion start position, so we can spring back to it when exiting.
//var firstMouse = Vector3(-1, -1, 0);
// Disable mouse look when the mouse leaves the player.
function OnMouseExit() { 
	trackMouseMotion(false);
//	if (firstMouse.x >= 0) Debug.Log('pretending to spring back to ' + firstMouse);
}
// Disable mouse look when we press 'escape'.
// Commented out: Record firstMouse for use by onMouseExit;
//var lastMouse = firstMouse;
function Update() {
	if (Input.GetKeyUp(KeyCode.Escape)) {
		//firstMouse.x = -1;  // Turn off springback.
		trackMouseMotion(false);
	} /*else if (Input.mousePosition == lastMouse) {
		firstMouse.x = -1;
		lastMouse = Input.mousePosition;
	} else if (firstMouse.x < 0) {
		firstMouse = Input.mousePosition;
	}*/
}
