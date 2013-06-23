static function sha1(bytes:byte[]) {
	var hash = System.Security.Cryptography.SHA1.Create().ComputeHash(bytes);
	var str = System.Convert.ToBase64String(hash);
	// base64url -- 27 chars for the 160-bit sha1
	str = str.Replace('=', '').Replace('+', '-').Replace('/', '_');
	// This is the earlier hex version, which is 40 chars long
	/* var sb = new System.Text.StringBuilder();
  	for (var byteChunk in hash) sb.Append(byteChunk.ToString("x2"));
  	var str = sb.ToString(); */
	return str;
}
static function sha1(serialized:String) {
	return sha1(System.Text.Encoding.ASCII.GetBytes(serialized));
}