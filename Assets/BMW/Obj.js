public var id = ''; // The BMW persistence id.

// Usually empty or same as id, but cand be different for groups (such as scenes).
// Used to determine if there's been a change.
public var hash = ''; 

// After the dust settles, I think this can be combined with hash into one dual-purpose var.
public var isGroup = false;

// The Select script defines a selected var, which includes hover-selection.
// FIXME: adjust the terminology.

// NB: Doc says this doesn't work on iPhone. What does?
function OnMouseDown() {
	Debug.Log('click ' + id);
	if (Application.isWebPlayer) 
		Application.ExternalCall('select', id);
}
