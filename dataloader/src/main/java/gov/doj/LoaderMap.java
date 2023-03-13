package gov.doj;

import java.util.HashMap;

public class LoaderMap {

  protected HashMap<String, Object> map = new HashMap<>();

  public LoaderMap() {
    map.put("cmmcd", new CMMCDLoader());
    map.put("cmmhr", new CMMHRLoader());
    map.put("cmhor", new CMHORLoader());
    map.put("cmmal", new CMMALLoader());
    map.put("cmhrp", new CMHRPLoader());
    //    map.put("cmmdb", new CMMDBLoader());
  }

  public void addLoader(String loaderName, Object loaderObject) {
    map.put(loaderName, loaderObject);
  }

  public void removeLoader(String loaderName) {
    map.remove(loaderName);
  }
}
