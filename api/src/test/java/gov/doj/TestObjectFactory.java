package gov.doj;

import gov.doj.adapters.gateways.AzureSqlGateway;
import gov.doj.adapters.presenters.JsonPresenter;
import gov.doj.usecases.PersistenceGateway;

public class TestObjectFactory extends ObjectFactory {

  public static void init() {
    registerObject(Presenter.class, new JsonPresenter());

    // List<String> profiles = ConfigUtils.getProfiles(); // uncomment this when a test
    // context/profile is added later
    registerObject(PersistenceGateway.class, new AzureSqlGateway()); // switch back to Local
  }
}
