using System;
using System.Globalization;

public class ObjUtil {

	public static float cf(string v) {
		return Convert.ToSingle(v.Trim(), new CultureInfo("en-US"));
	}
	
	public static int ci(string v) {
		return Convert.ToInt32(v.Trim(), new CultureInfo("en-US"));
	}

}
