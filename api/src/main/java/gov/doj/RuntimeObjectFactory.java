package gov.doj;

import gov.doj.adapters.gateways.AzureSqlGateway;
import gov.doj.adapters.gateways.LocalPersistenceGateway;
import gov.doj.adapters.presenters.JsonPresenter;
import gov.doj.usecases.PersistenceGateway;

public class RuntimeObjectFactory extends ObjectFactory {
    public static void init() {
        registerObject(Presenter.class, new JsonPresenter());
        registerObject(PersistenceGateway.class, new LocalPersistenceGateway());
    }

    public static void initCloud()
    {
        registerObject(Presenter.class, new JsonPresenter());
        registerObject(PersistenceGateway.class, new AzureSqlGateway());
    }
}
