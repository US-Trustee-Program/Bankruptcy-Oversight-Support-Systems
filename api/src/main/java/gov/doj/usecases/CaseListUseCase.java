package gov.doj.usecases;

import gov.doj.ObjectFactory;
import gov.doj.Presenter;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CaseListUseCase {

    public void getCases(String user) {
        PersistenceGateway persistenceGateway = ObjectFactory.getObjectByAbstractClass(PersistenceGateway.class);
        List<String> cases = persistenceGateway.getCases();

        Presenter presenter = ObjectFactory.getObjectByAbstractClass(Presenter.class);
        presenter.onSuccess(cases.toString());
    }
}
