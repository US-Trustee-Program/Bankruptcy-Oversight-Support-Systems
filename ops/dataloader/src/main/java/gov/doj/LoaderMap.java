package gov.doj;

import java.util.HashMap;

public class LoaderMap {

  protected HashMap<String, Object> map = new HashMap<>();

  public LoaderMap() {
    map.put("cmhor", new CmhorLoader());
    map.put("cmhmr", new CmhmrLoader());
    map.put("cmhpl", new CmhplLoader());
    map.put("cmhrp", new CmhrpLoader());
    map.put("cmmal", new CmmalLoader());
    map.put("cmmcd", new CmmcdLoader());
    map.put("cmhhr", new CmhhrLoader());
    map.put("cmmpr", new CmmprLoader());
    map.put("cmmpt", new CmmptLoader());
    map.put("cmmer", new CmmerLoader());
    //    map.put("cmmdb", new CMMDBLoader());
  }

  public void addLoader(String loaderName, Object loaderObject) {
    map.put(loaderName, loaderObject);
  }

  public void removeLoader(String loaderName) {
    map.remove(loaderName);
  }
}
