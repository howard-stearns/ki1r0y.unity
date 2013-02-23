static function sha1(bytes:byte[]) {
	var sb = new System.Text.StringBuilder();
  	for (var byteChunk in System.Security.Cryptography.SHA1.Create().ComputeHash(bytes)) 
    	sb.Append(byteChunk.ToString("x2"));
  	return sb.ToString();
}
static function sha1(serialized:String) {
	return sha1(System.Text.Encoding.ASCII.GetBytes(serialized));
}