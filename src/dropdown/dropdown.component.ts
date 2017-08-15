import 'rxjs/add/operator/takeUntil';
import 'rxjs/add/operator/takeUntil';

import {
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostListener,
  Input,
  IterableDiffers,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  NG_VALUE_ACCESSOR,
  Validator
} from '@angular/forms';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { MultiSelectSearchFilter } from './search-filter.pipe';
import {
  IMultiSelectOption,
  IMultiSelectSettings,
  IMultiSelectTexts
} from './types';

/*
 * Angular 2 Dropdown Multiselect for Bootstrap
 *
 * Simon Lindh
 * https://github.com/softsimon/angular-2-dropdown-multiselect
 */

@Component({
  selector: 'ss-multiselect-dropdown',
  templateUrl: './dropdown.component.html',
  styleUrls: ['./dropdown.component.css'],
  providers: [MULTISELECT_VALUE_ACCESSOR, MultiSelectSearchFilter]
})
export class MultiselectDropdown
  implements OnInit,
    OnChanges,
    DoCheck,
    OnDestroy,
    ControlValueAccessor,
    Validator {
  filterControl: FormControl = this.fb.control('');

  @Input() options: Array<IMultiSelectOption>;
  @Input() settings: IMultiSelectSettings;
  @Input() texts: IMultiSelectTexts;
  @Input() disabled = false;
  @Input() disabledSelection: false;
  @Output() selectionLimitReached = new EventEmitter();
  @Output() dropdownClosed = new EventEmitter();
  @Output() dropdownOpened = new EventEmitter();
  @Output() onAdded = new EventEmitter();
  @Output() onRemoved = new EventEmitter();
  @Output() onLazyLoad = new EventEmitter();
  @Output() onFilter: Observable<string> = this.filterControl.valueChanges;

  @HostListener('document: click', ['$event.target'])
  destroyed$ = new Subject<any>();

  filteredOptions: IMultiSelectOption[] = [];
  renderFilteredOptions: IMultiSelectOption[] = [];
  model: any[] = [];
  parents: any[];
  title: string;
  differ: any;
  numSelected = 0;
  renderItems = true;
  defaultSettings: IMultiSelectSettings = {
    closeOnClickOutside: true,
    pullRight: false,
    enableSearch: false,
    searchRenderLimit: 0,
    searchRenderAfter: 1,
    searchMaxLimit: 0,
    searchMaxRenderedItems: 0,
    checkedStyle: 'checkboxes',
    buttonClasses: 'btn btn-default btn-secondary',
    containerClasses: 'dropdown-inline',
    selectionLimit: 0,
    minSelectionLimit: 0,
    closeOnSelect: false,
    autoUnselect: false,
    showCheckAll: false,
    showUncheckAll: false,
    fixedTitle: false,
    dynamicTitleMaxItems: 3,
    maxHeight: '300px',
    isLazyLoad: false,
    stopScrollPropagation: false,
    loadViewDistance: 1
  };
  defaultTexts: IMultiSelectTexts = {
    checkAll: 'Check all',
    uncheckAll: 'Uncheck all',
    checked: 'checked',
    checkedPlural: 'checked',
    searchPlaceholder: 'Search...',
    searchEmptyResult: 'Nothing found...',
    searchNoRenderText: 'Type in search box to see results...',
    defaultTitle: 'Select',
    allSelected: 'All selected'
  };
  private _isVisible = false;
  private _workerDocClicked = false;
  onClick(target: HTMLElement) {
    if (!this.isVisible || !this.settings.closeOnClickOutside) {
      return;
    }

    let parentFound = false;
    while (target != null && !parentFound) {
      if (target === this.element.nativeElement) {
        parentFound = true;
      }
      target = target.parentElement;
    }
    if (!parentFound) {
      this.isVisible = false;
      this.dropdownClosed.emit();
    }
  }

  set isVisible(val: boolean) {
    this._isVisible = val;
    this._workerDocClicked = val ? false : this._workerDocClicked;
  }
  get isVisible() {
    return this._isVisible;
  }

  get searchLimit() {
    return this.settings.searchRenderLimit;
  }

  get searchRenderAfter() {
    return this.settings.searchRenderAfter;
  }

  get searchLimitApplied() {
    return this.searchLimit > 0 && this.options.length > this.searchLimit;
  }

  constructor(
    private element: ElementRef,
    private fb: FormBuilder,
    private searchFilter: MultiSelectSearchFilter,
    differs: IterableDiffers
  ) {
    this.differ = differs.find([]).create(null);
    this.settings = this.defaultSettings;
    this.texts = this.defaultTexts;
  }

  getItemStyle(option: IMultiSelectOption): any {
    if (!option.isLabel) {
      return { cursor: 'pointer' };
    }
  }

  getItemStyleSelectionDisabled(): any {
    if (this.disabledSelection) {
      return { cursor: 'default' };
    }
  }

  ngOnInit() {
    this.settings = Object.assign(this.defaultSettings, this.settings);
    this.texts = Object.assign(this.defaultTexts, this.texts);
    this.title = this.texts.defaultTitle || '';

    this.filterControl.valueChanges.takeUntil(this.destroyed$).subscribe(
      function() {
        this.updateRenderItems();
        if (this.settings.isLazyLoad) {
          this.load();
        }
      }.bind(this)
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['options']) {
      this.options = this.options || [];
      this.parents = this.options
        .filter(option => typeof option.parentId === 'number')
        .map(option => option.parentId);
      this.updateRenderItems();

      if (this.texts) {
        this.updateTitle();
      }
    }

    if (changes['texts'] && !changes['texts'].isFirstChange()) {
      this.updateTitle();
    }
  }

  ngOnDestroy() {
    this.destroyed$.next();
  }

  updateRenderItems() {
    this.renderItems =
      !this.searchLimitApplied ||
      this.filterControl.value.length >= this.searchRenderAfter;
    this.filteredOptions = this.searchFilter.transform(
      this.options,
      this.settings.isLazyLoad ? '' : this.filterControl.value,
      this.settings.searchMaxLimit,
      this.settings.searchMaxRenderedItems
    );
    this.renderFilteredOptions = this.renderItems ? this.filteredOptions : [];
  }

  onModelChange: Function = (_: any) => {};
  onModelTouched: Function = () => {};

  writeValue(value: any): void {
    if (value !== undefined && value !== null) {
      this.model = Array.isArray(value) ? value : [value];
    } else {
      this.model = [];
    }
  }

  registerOnChange(fn: Function): void {
    this.onModelChange = fn;
  }

  registerOnTouched(fn: Function): void {
    this.onModelTouched = fn;
  }

  setDisabledState(isDisabled: boolean) {
    this.disabled = isDisabled;
  }

  ngDoCheck() {
    const changes = this.differ.diff(this.model);
    if (changes) {
      this.updateNumSelected();
      this.updateTitle();
    }
  }

  validate(_c: AbstractControl): { [key: string]: any } {
    return this.model && this.model.length
      ? null
      : {
          required: {
            valid: false
          }
        };
  }

  registerOnValidatorChange(_fn: () => void): void {
    throw new Error('Method not implemented.');
  }

  clearSearch(event: Event) {
    if (event.stopPropagation) {
      event.stopPropagation();
    }
    this.filterControl.setValue('');
  }

  toggleDropdown() {
    this.isVisible = !this.isVisible;
    this.isVisible ? this.dropdownOpened.emit() : this.dropdownClosed.emit();
  }

  isSelected(option: IMultiSelectOption): boolean {
    return this.model && this.model.indexOf(option.id) > -1;
  }

  setSelected(_event: Event, option: IMultiSelectOption) {
    if (option.isLabel) {
      return;
    }
    if (!this.disabledSelection) {
      if (_event.stopPropagation) {
        _event.stopPropagation();
      }
      const index = this.model.indexOf(option.id);
      if (index > -1) {
        if (
          this.settings.minSelectionLimit === undefined ||
          this.numSelected > this.settings.minSelectionLimit
        ) {
          this.model.splice(index, 1);
          this.onRemoved.emit(option.id);
        }
        const parentIndex =
          option.parentId && this.model.indexOf(option.parentId);
        if (parentIndex >= 0) {
          this.model.splice(parentIndex, 1);
          this.onRemoved.emit(option.parentId);
        } else if (this.parents.indexOf(option.id) > -1) {
          const childIds = this.options
            .filter(
              child =>
                this.model.indexOf(child.id) > -1 &&
                child.parentId === option.id
            )
            .map(child => child.id);
          this.model = this.model.filter(id => childIds.indexOf(id) < 0);
          childIds.forEach(childId => this.onRemoved.emit(childId));
        }
      } else {
        if (
          this.settings.selectionLimit === 0 ||
          (this.settings.selectionLimit &&
            this.model.length < this.settings.selectionLimit)
        ) {
          this.model.push(option.id);
          this.onAdded.emit(option.id);
          if (option.parentId) {
            const children = this.options.filter(
              child =>
                child.id !== option.id && child.parentId === option.parentId
            );
            if (children.every(child => this.model.indexOf(child.id) > -1)) {
              this.model.push(option.parentId);
              this.onAdded.emit(option.parentId);
            }
          } else if (this.parents.indexOf(option.id) > -1) {
            const children = this.options.filter(
              child =>
                this.model.indexOf(child.id) < 0 && child.parentId === option.id
            );
            children.forEach(child => {
              this.model.push(child.id);
              this.onAdded.emit(child.id);
            });
          }
        } else {
          if (this.settings.autoUnselect) {
            this.model.push(option.id);
            this.onAdded.emit(option.id);
            const removedOption = this.model.shift();
            this.onRemoved.emit(removedOption);
          } else {
            this.selectionLimitReached.emit(this.model.length);
            return;
          }
        }
      }
      if (this.settings.closeOnSelect) {
        this.toggleDropdown();
      }
      this.model = this.model.slice();
      this.onModelChange(this.model);
      this.onModelTouched();
    }
  }

  updateNumSelected() {
    this.numSelected =
      this.model.filter(id => this.parents.indexOf(id) < 0).length || 0;
  }

  updateTitle() {
    if (this.numSelected === 0 || this.settings.fixedTitle) {
      this.title = this.texts ? this.texts.defaultTitle : '';
    } else if (
      this.settings.displayAllSelectedText &&
      this.model.length === this.options.length
    ) {
      this.title = this.texts ? this.texts.allSelected : '';
    } else if (
      this.settings.dynamicTitleMaxItems &&
      this.settings.dynamicTitleMaxItems >= this.numSelected
    ) {
      this.title = this.options
        .filter(
          (option: IMultiSelectOption) => this.model.indexOf(option.id) > -1
        )
        .map((option: IMultiSelectOption) => option.name)
        .join(', ');
    } else {
      this.title =
        this.numSelected +
        ' ' +
        (this.numSelected === 1
          ? this.texts.checked
          : this.texts.checkedPlural);
    }
  }

  searchFilterApplied() {
    return (
      this.settings.enableSearch &&
      this.filterControl.value &&
      this.filterControl.value.length > 0
    );
  }

  checkAll() {
    if (!this.disabledSelection) {
      const checkedOptions = (!this.searchFilterApplied()
        ? this.options
        : this.filteredOptions)
        .filter((option: IMultiSelectOption) => {
          if (this.model.indexOf(option.id) === -1) {
            this.onAdded.emit(option.id);
            return true;
          }
          return false;
        })
        .map((option: IMultiSelectOption) => option.id);
      this.model = this.model.concat(checkedOptions);
      this.onModelChange(this.model);
      this.onModelTouched();
    }
  }

  uncheckAll() {
    if (!this.disabledSelection) {
      const unCheckedOptions = !this.searchFilterApplied()
        ? this.model
        : this.filteredOptions.map((option: IMultiSelectOption) => option.id);
      this.model = this.model.filter((id: number) => {
        if (
          (unCheckedOptions.indexOf(id) < 0 &&
            this.settings.minSelectionLimit === undefined) ||
          unCheckedOptions.indexOf(id) < this.settings.minSelectionLimit
        ) {
          return true;
        } else {
          this.onRemoved.emit(id);
          return false;
        }
      });
      this.onModelChange(this.model);
      this.onModelTouched();
    }
  }

  preventCheckboxCheck(event: Event, option: IMultiSelectOption) {
    if (
      this.settings.selectionLimit &&
      !this.settings.autoUnselect &&
      this.model.length >= this.settings.selectionLimit &&
      this.model.indexOf(option.id) === -1 &&
      event.preventDefault
    ) {
      event.preventDefault();
    }
  }

  isCheckboxDisabled(): boolean {
    return this.disabledSelection;
  }

  checkScrollPosition(ev) {
    const scrollTop = ev.target.scrollTop;
    const scrollHeight = ev.target.scrollHeight;
    const scrollElementHeight = ev.target.clientHeight;
    const roundingPixel = 1;
    const gutterPixel = 1;

    if (
      scrollTop >=
      scrollHeight -
        (1 + this.settings.loadViewDistance) * scrollElementHeight -
        roundingPixel -
        gutterPixel
    ) {
      this.load();
    }
  }

  checkScrollPropagation(ev, element) {
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const scrollElementHeight = element.clientHeight;

    if (
      (ev.deltaY > 0 && scrollTop + scrollElementHeight >= scrollHeight) ||
      (ev.deltaY < 0 && scrollTop <= 0)
    ) {
      ev = ev || window.event;
      ev.preventDefault && ev.preventDefault();
      ev.returnValue = false;
    }
  }

  load() {
    this.onLazyLoad.emit({
      length: this.options.length,
      filter: this.filterControl.value
    });
  }
}

const MULTISELECT_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MultiselectDropdown),
  multi: true
};
