// Turns off mouse look when the mouse leaves the player.
// Attach this script to a GUITexture that covers the player, but which has no texture.
public var looks:MouseLook[];
function trackMouseMotion(enabled:boolean) {
	for (var script:MouseLook in looks) script.enabled = enabled;
}

public var lock = false;
function trackMouseMotion(enabled:boolean, doLock:boolean) {
	trackMouseMotion(enabled);
	lock = doLock;
}

// Note that iPhone doesn't have OnMouse<mumble>.
function OnMouseEnter() { if (lock) return; trackMouseMotion(true); }
function OnMouseDown() { if (lock) return; trackMouseMotion(true); }

function OnMouseExit() { trackMouseMotion(false); }
function Update() {
	if (Input.GetKeyUp(KeyCode.Escape)) trackMouseMotion(false);
}