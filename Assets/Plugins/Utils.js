static function sha1(serialized:String) {
	var sb = new System.Text.StringBuilder();
	var bytes = System.Text.Encoding.ASCII.GetBytes(serialized);
  	for (var byteChunk in System.Security.Cryptography.SHA1.Create().ComputeHash(bytes)) 
    	sb.Append(byteChunk.ToString("x2"));
  	return sb.ToString();
}