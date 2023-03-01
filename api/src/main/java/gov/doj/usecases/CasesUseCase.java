package gov.doj.usecases;

import gov.doj.ObjectFactory;
import gov.doj.Presenter;
import gov.doj.entities.*;
import java.util.List;
import java.util.Optional;

public class CasesUseCase {

    private PersistenceGateway persistenceGateway;
    private Presenter presenter;

    public CasesUseCase()
    {
        persistenceGateway = ObjectFactory.getObjectByAbstractClass(PersistenceGateway.class);
        presenter = ObjectFactory.getObjectByAbstractClass(Presenter.class);
    }

    public List<Case> getCases(){
        List<Case> cases = persistenceGateway.getCases();
        presenter.onSuccess(cases.toString());
        return cases;
    }

    public Optional<Case> getCaseById(long cases_id){
        Optional<Case> aCase = persistenceGateway.getCase(cases_id);
        presenter.onSuccess(aCase.toString());
        return aCase;
    }

    public boolean createCase(Case aCaseObj){

        boolean caseCreated = persistenceGateway.createCase(aCaseObj);
        presenter.onSuccess(caseCreated);
        return caseCreated;
    }

    public boolean updateCase(Case aCaseObj)
    {
        boolean caseUpdated = persistenceGateway.updateCase(aCaseObj);
        presenter.onSuccess("true");
        return true;
    }

    public boolean deleteCase(long cases_id)
    {
        boolean caseDeleted = persistenceGateway.deleteCase(cases_id);
        presenter.onSuccess("true");
        return true;
    }



}
