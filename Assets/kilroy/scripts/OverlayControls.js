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

// Disable mouse look when the mouse leaves the player.
function OnMouseExit() { trackMouseMotion(false); }
// Disable mouse look when we press 'escape'.
function Update() { if (Input.GetKeyUp(KeyCode.Escape)) trackMouseMotion(false); }