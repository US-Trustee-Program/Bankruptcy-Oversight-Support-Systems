package gov.doj.usecases;

import gov.doj.ObjectFactory;
import gov.doj.Presenter;

import java.util.List;

public class CaseListUseCase {

    public List<String> getCases(String user) {
        PersistenceGateway persistenceGateway = ObjectFactory.getObjectByAbstractClass(PersistenceGateway.class);
        List<String> cases = persistenceGateway.getCases();

        Presenter presenter = ObjectFactory.getObjectByAbstractClass(Presenter.class);
        presenter.onSuccess(cases.toString());
        return cases;
    }
}
