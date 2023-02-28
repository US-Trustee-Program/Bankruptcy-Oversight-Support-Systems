package gov.doj.usecases;

import gov.doj.ObjectFactory;
import gov.doj.Presenter;
import gov.doj.entities.*;
import java.util.List;

public class CasesUseCase {

    private PersistenceGateway persistenceGateway;
    private Presenter presenter;

    public CasesUseCase()
    {
        persistenceGateway = ObjectFactory.getObjectByAbstractClass(PersistenceGateway.class);
        presenter = ObjectFactory.getObjectByAbstractClass(Presenter.class);
    }

    public List<String> getCases(){
        List<String> cases = persistenceGateway.getCases();
        presenter.onSuccess(cases.toString());
        return cases;
    }

    public List<String> getCaseById(long cases_id){
        List<String> aCase = persistenceGateway.getCase(cases_id);
        presenter.onSuccess(aCase.toString());
        return aCase;
    }

    public long createCase(Case aCaseObj){

        long case_id = persistenceGateway.createCase(aCaseObj);
        presenter.onSuccess(case_id);
        return case_id;
    }

    public boolean updateCase(Case aCaseObj)
    {
        persistenceGateway.updateCase(aCaseObj);
        presenter.onSuccess("true");
        return true;
    }

    public boolean deleteCase(long cases_id)
    {
        persistenceGateway.deleteCase(cases_id);
        presenter.onSuccess("true");
        return true;
    }



}
