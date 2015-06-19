'use strict';
// ネームスペースの定義
var YourNamespace = YourNamespace || {};

// 定数
YourNamespace.const = {
    // 組織マスタ
    masterListTitle: 'OrgMaster',
    // ドロップダウンタイトル
    selectTitleCompany: 'Company',
    selectTitleDivision: 'Division',
    selectTitleSection: 'Section',
    // 組織マスタ列名
    columnInternalNameCompany: 'Company',
    columnInternalNameDivision: 'Division',
    columnInternalNameSection: 'Section'
};

// データマネージャーのデリゲート
YourNamespace.delegate = {
    // マスタアイテム取得成功
    onGetItemsSuccess: function (company, items) {
        YourNamespace.domManager.setDivisionSelect(company, items);
    },
    // マスタアイテム取得失敗
    onGetItemsFail: function (sender, args) {
        // TODO: handle error.
    }
}

// データマネージャー
YourNamespace.spDataManager = (function () {
    var SPDataManager = function () {
        this.items = null;
        this.delegate = null;
    };
    SPDataManager.prototype = {
        // 会社名を指定して組織マスタのリストアイテムを取得します。
        getMasterListItemsByCompanyAsync: function (company) {
            var self = this;
            var ctx = SP.ClientContext.get_current();
            var masterList = ctx.get_web()
                .get_lists()
                .getByTitle(YourNamespace.const.masterListTitle);

            var camlQuery = new SP.CamlQuery();
            camlQuery.set_viewXml(
                '<View>' +
                    '<Query>' +
                        '<Where><Eq>' +
                            '<FieldRef Name=\'' + YourNamespace.const.columnInternalNameCompany + '\'/>' +
                            '<Value Type=\'Text\'>' + company + '</Value>' +
                        '</Eq></Where>' +
                    '</Query>' +
                '</View>'
            );
            self.items = masterList.getItems(camlQuery);
            ctx.load(self.items);
            ctx.executeQueryAsync(
                function () {
                    self.delegate.onGetItemsSuccess(company, self.items);
                },
                function (sender, args) {
                    self.delegate.onGetItemsFail(sender, args);
                });
        },
        getSectionsByParents: function (targetCompnay, targetDivision) {
            var self = this;
            if (self.items === null) {
                return null;
            }

            var sections = [];
            var enumerator = self.items.getEnumerator();
            while (enumerator.moveNext()) {
                var item = enumerator.get_current();
                var company = item.get_item(YourNamespace.const.columnInternalNameCompany);
                var division = item.get_item(YourNamespace.const.columnInternalNameDivision);

                if (targetCompnay === company && targetDivision === division) {
                    // 会社名と部名が一致するアイテムの課を取得
                    var section = item.get_item(YourNamespace.const.columnInternalNameSection);
                    sections.push(section);
                }
            }

            return sections;
        }
    };
    var manager = new SPDataManager();
    manager.delegate = YourNamespace.delegate;
    return manager;
})();

// DOMマネージャー
YourNamespace.domManager = {
    // 「会社名」ドロップダウンを取得します。
    findCompanyDropdown: function () {
        return $("select[title='" + YourNamespace.const.selectTitleCompany + "'], "
            + "select[title='" + YourNamespace.const.selectTitleCompany + " Required Field']");
    },
    // 「部」ドロップダウンを取得します。
    findDivisionDropdown: function () {
        return $("select[title='" + YourNamespace.const.selectTitleDivision + "'], "
            + "select[title='" + YourNamespace.const.selectTitleDivision + " Required Field']");
    },
    // 「課」ドロップダウンを取得します。
    findSectionDropdown: function () {
        return $("select[title='" + YourNamespace.const.selectTitleSection + "'], "
            + "select[title='" + YourNamespace.const.selectTitleSection + " Required Field']");
    },
    // 選択されている会社名を取得します。
    getSelectedCompany: function () {
        var select = this.findCompanyDropdown();
        if (select) {
            return select.val();
        } else {
            return '';
        }
    },
    // 選択されている部を取得します。
    getSelectedDivision: function () {
        var select = this.findDivisionDropdown();
        if (select) {
            return select.val();
        } else {
            return '';
        }
    },
    // 「部」ドロップダウンの中身を設定します。
    setDivisionSelect: function (company, items) {
        var self = this;
        // 部の選択肢をクリア
        self.findDivisionDropdown().find('option').remove();

        var divisions = [];
        var enumerator = items.getEnumerator();
        while (enumerator.moveNext()) {
            var item = enumerator.get_current();
            var division = item.get_item(YourNamespace.const.columnInternalNameDivision);

            if ($.inArray(division, divisions) < 0) {
                divisions.push(division);
            }
        }

        $.each(divisions, function (i, value) {
            self.findDivisionDropdown().append($('<option></option>')
            .attr('company', company)
            .val(value)
            .text(value));
        });

        if (0 < divisions.length) {
            self.setSectionSelect(company, divisions[0]);
        }
    },
    // 「課」ドロップダウンの中身を設定します。
    setSectionSelect: function (company, division) {
        var self = this;
        // 課の選択肢をクリア
        self.findSectionDropdown().find('option').remove();

        var sections = YourNamespace.spDataManager.getSectionsByParents(company, division);

        // 「課」ドロップダウンの中身を設定
        if (sections) {
            $.each(sections, function (i, value) {
                self.findSectionDropdown().append($('<option></option>')
                    .attr('company', company)
                    .attr('division', division)
                    .val(value)
                    .text(value));
            });
        }
    },
    // 「部」、「課」のドロップダウンの中身を空にします。
    clearDropdownSelection: function () {
        this.findDivisionDropdown().find('option').remove();
        this.findSectionDropdown().find('option').remove();
    },
    // 会社選択変更時のイベントを設定
    setCompanyDropdownChangeEvent: function () {
        var self = this;
        self.findCompanyDropdown().change(function () {
            // 部、課の選択肢をクリア
            self.clearDropdownSelection();
            // マスタ取得
            YourNamespace.spDataManager.getMasterListItemsByCompanyAsync($(this).val());
        });
    },
    // 部選択変更時のイベントを設定
    setDivisionDropdownChangeEvent: function () {
        var self = this;
        self.findDivisionDropdown().change(function () {
            self.setSectionSelect(
                self.getSelectedCompany(),
                self.getSelectedDivision());
        });
    }
};

$(document).ready(function () {
    // 初期選択の会社名を取得
    var selectedCompany = YourNamespace.domManager.getSelectedCompany();

    // マスタ初期取得
    YourNamespace.spDataManager.getMasterListItemsByCompanyAsync(selectedCompany);

    // ドロップダウンのイベント設定
    YourNamespace.domManager.setCompanyDropdownChangeEvent();
    YourNamespace.domManager.setDivisionDropdownChangeEvent();
});