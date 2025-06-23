import { SelectionService } from './SelectionService.humble';
import { ListUtilities } from './ListUtilities';
import { ListToggleService } from './ListToggleService';
import { ListIndentationService } from './ListIndentationService';
import { ListNavigationService } from './ListNavigationService';

export class ListService {
  private listUtilities: ListUtilities;
  private listToggleService: ListToggleService;
  private listIndentationService: ListIndentationService;
  private listNavigationService: ListNavigationService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.listUtilities = new ListUtilities(root, selectionService);
    this.listToggleService = new ListToggleService(root, selectionService, this.listUtilities);
    this.listIndentationService = new ListIndentationService(root, selectionService);
    this.listNavigationService = new ListNavigationService(
      root,
      selectionService,
      this.listUtilities,
    );
  }

  public toggleList(type: 'ul' | 'ol'): void {
    return this.listToggleService.toggleList(type);
  }

  public handleDentures(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    return this.listIndentationService.handleDentures(e);
  }

  public handleEnterKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    return this.listNavigationService.handleEnterKey(e);
  }

  public handleDeleteKeyOnList(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    return this.listNavigationService.handleDeleteKeyOnList(e);
  }

  public unwrapListItem(
    li: HTMLLIElement,
    list: HTMLOListElement | HTMLUListElement,
    range: Range,
  ): void {
    return this.listUtilities.unwrapListItem(li, list, range);
  }

  public createListWithEmptyItem(type: 'ul' | 'ol'): HTMLElement {
    return this.listUtilities.createListWithEmptyItem(type);
  }
}
