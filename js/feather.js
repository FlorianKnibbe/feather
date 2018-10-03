/*******************************************************************
Copyright 2015 Florian Knibbe
This file is part of Feather.

Feather is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Feather is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with Feather.  If not, see <http://www.gnu.org/licenses/>.
/*******************************************************************/

/**
 * Définition de l'objet Feather
 */
 var Feather = function(){

 	// Public variable
 	this.session = {};
 	this.get = {};
 	this.post = {};
 	this.config = {};
 	this.touchendEvent = 'ontouchend' in document ? 'vclick' : 'click';

 	// Private variable
 	var fth = this; 
 	var parameters ={};
 	
	/**
	 * [init -> Initialisation du framework]
	 * @param  {[json]} options [surcharge des paramètres de base du framework]
	 * - @option {[number]} version [Numéro de version]
	 * - @option {[array]} asyncRessource [Tableau d'url de ressources à charger avant lancement de Feather]
	 * - @option {[function]} onArticleReady [Fonction à executer après le chargement du première article]
	 * - @option {[string]} defaultSection [Selecteur vers la section à ouvrir par défaut au chargement de Feather]
	 * @return {[type]}
	 */
	 this.init = function(options) {
	 	var defaults = {
	 		'version': '0.5',
	 		'asyncRessources': [],
	 		'onArticleReady': function(){},
	 		'ajaxCache': false,
	 		'defaultSection': '[data-role="feather"]>section:first', // Par defaut la section qui sera chargé est le première present dans la page
	 		'defaultArticle': '[data-role="feather"] section.active>article:first',
	 		'configFile': '',
	 		'onFeatherReady': function(){}
	 	};

		//On fusionne nos deux objets !
		parameters = $.extend(defaults, options);

		// Y-a t-il un fichier de config extérieur à charger
		if($.trim(parameters.configFile) != ''){
			try{
				$.post(parameters.configFile,{},function(data){
					fth.config = data;
				},'json');
			}catch(e){
				return fth.pushError({
					'methode':'init',
					'message':"Impossible de charger le fichier de config suivant : "+parameters.configFile
				});
			}
		}

		// Activation ou non du cache ajax Jquery
		$.ajaxSetup({cache: parameters.ajaxCache});

		var cptRessource = 0; 
		$.each(parameters.asyncRessources,function(index, value){
			$.ajax({
				url: value,
				success: function(data) {
					$('[data-role="feather"]').append(data);
				},
				error: function(data) {
					return fth.pushError({
						'methode':'init',
						'message':"Ressouce "+value+" impossible à charger"
					});
				}
			}).done(function() {
				cptRessource++;
				// Lorsque toutes les ressources sont chargées -> on passe à la suite
				// Si on attend pas risque de plantage car section potentiellement pas chargée
				if(cptRessource >= parameters.asyncRessources.length){
					// On charge l'article par defaut ou celui indiqué par l'utilisateur
					fth.goToSection(parameters.defaultSection,{
						onArticleReady:function(){
							fth.preloader.close();
							parameters.onArticleReady();
						},
						defaultArticle: parameters.defaultArticle
					});
					// Initialisation des eventListeners
					fth.initEventListener();
					// On a fini tous les traitements et préparatifs on peu afficher l'appli
					$('[data-role="feather"]').addClass('active');
					parameters.onFeatherReady();
				}
			});
		});
};


	/**
	 * [goToArticle -> permet de router vers un article via un selecteur de balise 'article']
	 * @param {[string]} idArticle [Selecteur d'une balise article à afficher]
	 * @param {[json]} options [Json d'options]
	 * - @option {[url]} asyncRessource [Chemin vers un script html à charger (facultatif)]
	 * - @option {[function]} onArticleReady [Fonction à executer après le changement d'article (après la fonction "activeArticle") (facultatif)]
	 * - @option {[boolean]} forceAsync [Indique qu'il faut forcer le rechargement de la ressource asynchrone]
	 * @return {[object]} fth [Object Feather]
	 */
	 this.goToArticle = function(idArticle,options){
	 	var idArticle = $.trim(idArticle);
	 	var options = options || {};
	 	var asyncArticle = options.asyncArticle || '';
	 	var onArticleReady = options.onArticleReady || function(){};
	 	var forceAsyncArticle = options.forceAsyncArticle || false;
	 	// Sauvegarde des données POST présente dans options.data
	 	fth.post = options.data || {};
	 	// Sauvegarde des données GET passé dans l'idArticle
	 	fth.get = fth.getToJson(idArticle);
	 	// Si des GET étaient présent dans l'idArticle -> on les supprimes pour la suite
	 	if(!$.isEmptyObject(Feather.get)){
	 		var tmp = idArticle.split('?');
	 		idArticle = tmp[0];
	 	}
	 	if(forceAsyncArticle !== false && forceAsyncArticle !== undefined){
	 		$(idArticle).remove();
	 	}
	 	var $elem = $(idArticle);
	 	fth.hideAsideMenu($('[data-role="feather"] section.active'));
	 	if($elem.length == 0 && asyncArticle == ''){
	 		return fth.pushError({
	 			'methode':'goToArticle',
	 			'message':"Article à afficher introuvable"
	 		});
	 	}else if($elem.length == 0 && asyncArticle != ''){
	 		$.ajax({
	            type: 'GET',
	            url: asyncArticle,
	            timeout: 5000,
	            success: function(data) {
	              	$('[data-role="feather"] section.active').append(data);
		 			// Garnir le template
		 			fth.fillTemplate(idArticle);
		 			// Attention : On passe $(idArticle) en paramètre de "activeArticle" au lieu de $elem car $elem était vide avant le $.post
		 			return fth.activeArticle($(idArticle),onArticleReady); 
	          	},error: function(e) {
	              fth.pushError({
						'methode':'goToArticle',
						'message':"Erreur de chargement de la ressource asynchrone suivante : "+asyncArticle
				   });
	          	}
		    });   
	 	}else if($elem.length > 0){
	 		return fth.activeArticle($elem,onArticleReady);
	 	}else{
	 		return fth.pushError({
	 			'methode':'goToArticle',
	 			'message':"Erreur inconnue"
	 		});
	 	}
	 }

	/**
	 * [activeArticle ->Permet d'activer/d'afficher l'article indiqué]
	 * @param  {[DOM object]} elem [Objet DOM correspondant à l'article à afficher]
	 * @param  {[function]} callback [fonction à executer après l'activation d'un article (facultatif)]
	 * @return {[object]} fth -> objet Feather
	 */
	 this.activeArticle = function(elem,callback){
	 	var callback = callback || function(){};
	 	if(elem.length == 0){
	 		return fth.pushError({
	 			'methode':'activeArticle',
	 			'message':"Article à activer introuvable"
	 		});
	 	}else{
	 		$('[data-role="feather"] section article.active').removeClass('active');
	 		fth.activeNavForArticle(elem);
	 		elem.addClass('active');
	 		callback();
	 		return fth;
	 	}
	 }

	/**
	 * [goToSection -> Permet d'activer/afficher une section]
	 * @param  {[string]} idSection -> Selecteur d'une balise section à afficher
	 * @param  {[json]} options [Option de chargement de la section]
	 * - @option  {[string]} asyncRessource [Chemin vers un script html à charger (facultatif)]
	 * - @option  {[string]} defaultArticle [Selecteur vers l'article par défaut à afficher]
	 * - @option  {[function]} onArticleReady -[Fonction à executer après l'activation d'un article lors du changement de section (après la fonction "activeArticle") (facultatif)]
	 * @return {[object]} fth [Objet feather]  
	 */
	 this.goToSection = function(idSection,options){ 
		var options = options || {};
		var asyncSection = options.asyncSection || '';
		var asyncArticle = options.asyncArticle || '';
		var idDefaultArticle = options.defaultArticle || '[data-role="feather"] section.active>article:first'; // Par défaut on active le premier article de la section
		var onArticleReady = options.onArticleReady || function(){};
		var idSection = $.trim(idSection);
		var forceAsyncSection = options.forceAsyncSection || false;
		var forceAsyncArticle = options.forceAsyncArticle || false;
		if(forceAsyncSection !== false && forceAsyncSection !== undefined){
			$(idSection).remove();
		}
		var $elem = $(idSection);
		fth.hideAsideMenu($('[data-role="feather"] section.active'));
		setTimeout(function(){
			if($elem.length == 0 && asyncSection == ''){
				return fth.pushError({
					'methode':'goToSection',
					'message':"Section à afficher introuvable"
				});
			}else if($elem.length == 0 && asyncSection != ''){
				$.ajax({
		            type: 'GET',
		            url: asyncSection,
		            timeout: 5000,
		            success: function(data) {
		              	$('[data-role="feather"]').append(data);
						$elem = $(idSection); // On remet à jour le selecteur car avant le $.post l'element était undefined si on est dans ce if
						return fth.activeSection($elem).goToArticle(idDefaultArticle,{
							onArticleReady:onArticleReady,
							asyncArticle: asyncArticle,
							forceAsyncArticle: forceAsyncArticle
						});
		          	},error: function(e) {
		              fth.pushError({
							'methode':'goToSection',
							'message':"Erreur de chargement de la ressource asynchrone suivante : "+asyncSection
					   });
		          	}
		        });   
			}else if($elem.length > 0){
				return fth.activeSection($elem).goToArticle(idDefaultArticle,{
					onArticleReady:onArticleReady,
					asyncArticle: asyncArticle,
					forceAsyncArticle: forceAsyncArticle
				});
			}else{
				return fth.pushError({
					'methode':'goToSection',
					'message':"Erreur inconnue"
				});
			}
		},500);// 500 ms de timeout pour que l'animation de fermeture du aside menu est le temps de se faire.
	}

	/**
	 * [activeSection -> Permet d'activer/d'afficher la section indiqué]
	 * @param  {[DOM object]} elem [Objet DOM correspondant à la section à afficher]
	 * @return {[object]} fth [objet Feather]
	 */
	 this.activeSection = function(elem){
	 	if($(elem).length == 0){
	 		return fth.pushError({
	 			'methode':'activeSection',
	 			'message':"Section à activer introuvable"
	 		});
	 	}else{
	 		$('[data-role="feather"] section.active').removeClass('active');
	 		$(elem).addClass('active');
	 		return fth;
	 	}
	 }

	 

	/**
	 * [activeNavForArticle -> Permet d'activer la ou les eventuelles bar de navigation liées à l'article]
	 * @param  {[DOM object]} elem [Objet DOM correspondant à l'article à afficher]
	 * @return {[none]}
	 */
	 this.activeNavForArticle = function(elem){
	 	var idArticle = $(elem).attr('id');
		// On cache toutes les barres de navigation 'nav' qui sont actuellement active
		$('[data-role="feather"] nav[data-role="groupBarTop"].active').removeClass('active');
		$('[data-role="feather"] nav[data-role="groupBarBottom"].active').removeClass('active');	
		var navBar = $('[data-role="feather"] section.active nav[data-for-articles~="#'+idArticle+'"]');
		if(navBar.length > 0){
			navBar.addClass("active");
			navBar.find('a.active[data-view-article!="'+idArticle+'"]').removeClass('active');
			navBar.find('a[data-view-article="#'+idArticle+'"]').addClass('active');
		}

		// Activation du menu aside si besoin
		$('[data-role="feather"] aside [data-view-article],[data-role="feather"] aside [data-view-section]').removeClass('active');
		var item = $('[data-role="feather"] aside [data-view-article="#'+idArticle+'"]');
		if(item.length <= 0){
			$('[data-role="feather"] aside [data-default-article="#'+idArticle+'"]').addClass('active');
		}else{
			item.addClass('active');
		}
		
	}

	/**
	 * [hideAsideMenu -> Permet de faire disparaitre un menu aside avec une animation CSS]
	 * @param  {[DOM object]} elem [Objet DOM de la section qui doit cacher le menu aside
	 * @return {[none]}
	 */
	 this.hideAsideMenu = function(elem){
	 	elem.removeClass('showAside');
	 };

	/**
	 * [showAsideMenu -> Permet de faire apparaitre un menu aside avec une animation CSS]
	 * @param  {[DOM object]} elem [selecteur du menu aside à faire apparaitre]
	 * @return {[none]}
	 */
	 this.showAsideMenu = function(elem){
	 	elem.addClass('showAside');
	 };


	/**
	 * [initEventListener -> Permet d'initialiser tous les listeners de clic/touch commun à toute l'application]
	 * @return {[none]}
	 */
	 this.initEventListener = function(){
		// Sur clic d'un bouton pour afficher un menu -> bouton possédant l'attribut "data-view-aside"
		$('[data-role="feather"]').on(fth.touchendEvent,'[data-view-aside]',function(event){
			event.preventDefault();
			var sectionActive = $(this).closest('section');
			if(sectionActive.hasClass('showAside')){
				fth.hideAsideMenu(sectionActive);
			}else{
				fth.showAsideMenu(sectionActive);
			}
		});
		
		// Sur clic d'un bouton pour afficher un article -> bouton possédant l'attribut "data-view-article"
		$('[data-role="feather"]').on(fth.touchendEvent,'[data-view-article]',function(event){
			event.preventDefault();
			// Est-ce qu'on force le chargement asynchrone
			var forceAsyncArticle = $(this).attr('data-force-async-article');
			if (typeof forceAsyncArticle !== typeof undefined && forceAsyncArticle !== false && forceAsyncArticle !== 0) {
				forceAsyncArticle = true;
			}
			// Vérification et récupération des POST
			var validPost = $(this).attr('data-validPost');
			var postId = $(this).attr('data-sendPost');
			var data = {};
			if (typeof postId !== typeof undefined && postId !== false) {
				data = fth.postToJson(postId);
			}
			if (typeof validPost !== typeof undefined && validPost !== false && typeof postId !== typeof undefined && postId !== false) {
				var testPost = fth.validPost($(this).attr('data-sendPost'));
				if(testPost.etat == 'ko'){
					fth.alert(fth.showErr(testPost.message));
					return;
				}
			}
			fth.goToArticle($(this).attr('data-view-article'),{
				asyncArticle:$(this).attr('data-async-article'),
				data: data,
				forceAsyncArticle: forceAsyncArticle
			});
		});
		// Sur clic d'un bouton pour afficher une section -> bouton possédant l'attribut "data-view-section"
		$('[data-role="feather"]').on(fth.touchendEvent,'[data-view-section]',function(event){
			event.preventDefault();
			var forceAsyncSection = $(this).attr('data-force-async-section');
			if (typeof forceAsyncSection !== typeof undefined && forceAsyncSection !== false && forceAsyncSection !== 0) {
				forceAsyncSection = true;
			}
			var forceAsyncArticle = $(this).attr('data-force-async-article');
			if (typeof forceAsyncArticle !== typeof undefined && forceAsyncArticle !== false && forceAsyncArticle !== 0) {
				forceAsyncArticle = true;
			}
			fth.goToSection($(this).attr('data-view-section'),{
				defaultArticle:$(this).attr('data-default-article'),
				asyncSection:$(this).attr('data-async-section'),
				asyncArticle:$(this).attr('data-async-article'),
				forceAsyncSection: forceAsyncSection,
				forceAsyncArticle: forceAsyncArticle,
				data: $(this).attr('data-sendPost')
			});
		});

		// Si class 'showAsideOnSwipe' définie sur section -> affichage du menu Aside sur swipe left et fermeture sur swipe right
		$(document).on('swiperight','section.active.showAsideOnSwipe:not(.showAside)',function(e,touch){
	        if(Number(touch.startEvnt.position.x) < 0 || Number(touch.startEvnt.position.x) > 50){
	            return;
	        }
	        Feather.showAsideMenu($(this));
	    });
	    $(document).on('swipeleft','section.active.showAside.showAsideOnSwipe',function(e,touch){
	        var sectionWidth = Number($('section.showAside').width());
	        var sectionWidthLimit = Number(sectionWidth - 50);
	        if(Number(touch.startEvnt.position.x) > sectionWidth || Number(touch.startEvnt.position.x) < sectionWidthLimit){
	            return;
	        }
	        Feather.hideAsideMenu($(this));
	    });
	};

	/**
	 * [loader -> Permet d'afficher un loader html ou de le cacher]
	 * @param  {[string]} action [indique si on veut afficher le loader "open" ou le cacher "close"]
	 * @param  {[html]} htmlContent [facultatif, il permet de personnaliser le contenu du loader]
	 * @return {[none]}
	 */
	 this.loader = function(action,htmlContent){
	 	var htmlContent = htmlContent || '<div><p><span class="icon-spinner margin-right rotate"></span>Traitement en cours...</p></div>';
	 	if(action == 'open'){
	 		$('[data-role="feather"]').append('<div id="_featherLoader"><div id="_featherLoaderContent">'+htmlContent+'</div></div>')
	 	}else{
	 		$('#_featherLoader').remove();
	 	}
	 };

	/**
	 * [alert -> Permet d'afficher une alert html personnalisée]
	 * @param  {[html]} htmlContent [permet d'indiquer le contenu html de l'alert]
	 * @param  {[json]} options [facultatif, permet d'ajouter des options]
	 * - @option  {[string]} txtBtnClose [facultatif, permet de modifier le texte du bouton "Fermer"]
	 * - @option  {[function]} onExit [Permet d'executer une fonction à la fermeture de l'alert]
	 * @return {[none]}
	 */
	 this.alert = function(htmlContent,options){
	 	var htmlContent = htmlContent || '';
	 	var options = options || {};
	 	var onExit = options.onExit || function(){};
	 	var txtBtnClose = options.txtBtnClose || 'Fermer';
	 	$('[data-role="feather"]').append('<div id="_featherAlert"><div id="_featherAlertContent" class="bck-white"><div class="padding">'+htmlContent+'</div><div id="_featherAlertButtons" class="padding text right"><button type="button" class="theme" id="_featherAlertButtonClose">'+txtBtnClose+'</button></div></div></div>');
	 	$('#_featherAlert #_featherAlertButtonClose').on(fth.touchendEvent,function(event){
	 		event.preventDefault();
	 		$('#_featherAlert').remove();
	 		$('#_featherAlert #_featherAlertButtonClose').off(fth.touchendEvent);
	 		onExit();
	 	});
	 };

	/**
	 * [confirm -> Permet d'afficher un confirm html]
	 * @param  {[html]} htmlContent -> permet d'indiquer le contenu html du confirm
	 * @param  {[json]} options [facultatif, permet d'ajouter des options facultatives]
	 * - @option  {[function]} onYes [permet d'executer une fonction lors du clic sur le bouton "Oui"]
	 * - @option  {[function]} onNo [permet d'executer une fonction lors du clic sur le bouton "Non"]
	 * - @option  {[string]} txtBtnYes [facultatif, permet de modifier le texte du bouton "Oui"]
	 * - @option  {[string]} txtBtnNo [facultatif, permet de modifier le texte du bouton "Non"]
	 * @return {[none]}
	 */
	 this.confirm = function(htmlContent,options){
	 	var htmlContent = htmlContent || '';
	 	var options = options || {};
	 	var onYes = options.onYes || function(){};
	 	var onNo = options.onNo || function(){};
	 	var txtBtnYes = options.txtBtnYes || 'Oui';
	 	var txtBtnNo = options.txtBtnNo || 'Non';
	 	var classBtnYes = '';
	 	var classBtnNo = ' margin-left';
	 	if($(window).width() < 500){
	 		classBtnYes = ' fullWidth margin-bottom';
	 		classBtnNo = ' fullWidth';
	 	}
	 	$('[data-role="feather"]').append('<div id="_featherConfirm"><div id="_featherConfirmContent" class="bck-white"><div class="padding">'+htmlContent+'</div><div id="_featherConfirmButtons" class="padding text right"><button type="button" class="theme'+classBtnYes+'" id="_featherConfirmButtonYes">'+txtBtnYes+'</button><button type="button" class="theme'+classBtnNo+'" id="_featherConfirmButtonNo">'+txtBtnNo+'</button></div></div></div>');
	 	$('#_featherConfirm #_featherConfirmButtonYes').on(fth.touchendEvent,function(event){
	 		event.preventDefault();
	 		$('#_featherConfirm').remove();
	 		$('#_featherConfirm #_featherConfirmButtonYes').off(fth.touchendEvent);
	 		onYes();
	 	});
	 	$('#_featherConfirm #_featherConfirmButtonNo').on(fth.touchendEvent,function(event){
	 		event.preventDefault();
	 		$('#_featherConfirm').remove();
	 		$('#_featherConfirm #_featherConfirmButtonNo').off(fth.touchendEvent);
	 		onNo();
	 	});
	 };

	 /**
	 * [Objet dialog -> utilisation Feather.dialog.X]
	 */
	 this.dialog = {
	 	/**
		 * [open -> Permet d'afficher un dialog html totalement personnalisable]
		 * @param  {[html]} htmlContent -> permet d'indiquer le contenu html du dialog
		 * @return {[none]}
		 */
		 open: function(htmlContent){
		 	var htmlContent = htmlContent || '';
		 	$('[data-role="feather"]').append('<div id="_featherDialog"><div id="_featherDialogContent" class="bck-white">'+htmlContent+'</div>');
		 },
	 	/**
		 * [close -> Permet de fermer un dialog]
		 * @param  {[none]}
		 * @return {[none]}
		 */
		 close: function(){
		 	$('#_featherDialog').remove();
		 }
		};

	/**
	 * [Objet preloader -> utilisation Feather.preloader.X]
	 */
	 this.preloader = {
	 	/**
		 * [open -> Permet d'afficher le preloader html]
		 * @param  {[none]}
		 * @return {[none]}
		 */
		 open: function(){
		 	$('[data-role="preloader"]').removeClass('hide');
		 },
	 	/**
		 * [close -> Permet de fermer le preloader]
		 * @param  {[none]}
		 * @return {[none]}
		 */
		 close: function(){
		 	$('[data-role="preloader"]').addClass('hide');
		 }
		};

	/**
	 * [pushError -> Permet de personnaliser le retour d'erreur du framework]
	 * @param  {[object]} erreur [objet d'erreur avec les clés "message", "method", etc...]
	 * @return {[type]}
	 */
	 this.pushError = function(erreur){
	 	alert(" ERROR : "+erreur.methode+" -> "+erreur.message);
	 	return false;
	 };

	 /**
	 * [preparePost -> Permet de récupérer toutes les valeurs des input/select/radio/checkbox enfants d'un élément et d'en faire un objet json sous forme [{name:myName,value:myValue},{name:myName2,value:myValue2}]
	 * @param  {[string]} sel [Selecteur de l'élément dans lequel on doit récupérer les valeurs des input/select/radio/checkbox]
	 * @param  {[object]} plus [facultatif, json de données à ajouté à l'objet renvoyé par la fonction]
	 * @return {[object]} o [objet avec tous les posts]
	 */
	 this.preparePost = function(sel, plus) { 
	 	var sel = sel || "";
	 	var plus = plus || {};

	 	if (sel == ""){
	 		var mypost = [];
	 	}else{
	 		_jqtmp2 = $(sel).filter("input[type=hidden]");
	 		_jqtmp = $(sel).filter(":input").filter(":enabled").add(_jqtmp2);
	 		_jqtmp3 = $(sel).find("*").filter("input[type=hidden]");
	 		var mypost = $(sel).find("*").filter(":input").filter(":enabled").add(_jqtmp3).add(_jqtmp).serializeArray();
	 	}
	 	var et = new Array();
	 	var j = 0;
	 	for (i in plus){
	 		if ($.isArray(plus[i])){
	 			for (k in plus[i])
	 			{
	 				et[j] = {name : i + "[]" , value : plus[i][k]};
	 				j = j + 1;
	 			}
	 		}else{
	 			et[j] = {name : i , value : plus[i]};
	 			j = j + 1;
	 		}
	 	}
	 	$.merge(mypost,et);
	 	return mypost;
	 };

	 /**
	  * [postToJson description]
	  * @param  {[string]} selector [Selecteur de l'élément dans lequel on doit récupérer les valeurs des input/select/radio/checkbox]
	  * @param  {[object]} cmplt    [facultatif, json de données à ajouté à l'objet renvoyé par la fonction]
	  * @return {[object]}          [Objet sous la forme {cle:valeur,cle:valeur}]
	  */
	  this.postToJson = function(selector, cmplt){
	  	var selector = selector || '';
	  	var cmplt = cmplt || {};
	  	var mypost = fth.preparePost(selector,cmplt);
	 	// On remplace le [{name:myName,value:myValue},{name:myName2,value:myValue2}] par {myName:value,myName2:value2}
	 	var o = {};
	 	$.each(mypost,function(i,item){
			// Detection des tableaux
			var reg = new RegExp("\\[.+\\]", "ig");
			var reg2 = new RegExp("\\[\\]", "ig");
			if(reg.test(item.name)){
				var subName = item.name.substring(item.name.lastIndexOf("[")+1,item.name.lastIndexOf("]")).toString();
				if(!( (typeof o[item.name.replace(reg, "")] === "object") && (o[item.name.replace(reg, "")] !== null)) ) {
					// Si l'objet n'existe pas, on l'initialise
					o[item.name.replace(reg, "")] = {};
				}
				o[item.name.replace(reg, "")][subName] = item.value;
			}else if(reg2.test(item.name)){
				item.name = item.name.replace(reg2, "");
				if(!($.isArray(o[item.name]))){
					o[item.name] = [];
				}
				o[item.name].push(item.value);
			}else{
				o[item.name] = item.value;
			}
		});
	 	return o;
	 };

	 this.validPost = function(sel){
	 	var $sel = $(sel).find('input:enabled, select:enabled, textarea:enabled');
	 	var object = {};
	 	var myTestIsOk = true;
	 	var mess;
	 	$sel.each(function(){
	 		// Si l'element checké possède un name avec [.*] et avec un attribut data-required
	 		var hasDataRequired = $(this).attr('data-required');
	 		var myTitle = $(this).attr('title');
	 		var myName = $(this).attr('name')
			if(typeof myTitle !== typeof undefined && myTitle !== false){
				mess = $(this).attr('title');
			}else{
				mess = "Le champ "+myName+" est invalide";
			}
	 		if (typeof hasDataRequired !== typeof undefined && hasDataRequired !== false) {
	 			var reg = new RegExp("\\[.*\\]", "ig");
	 			if(reg.test(myName)){
	 				var subName = myName.replace(reg, '');
	 				if(hasDataRequired == '+'){
	 					if(Number($('[name^="'+subName+'"]:checked').length) <= 0){
	 						myTestIsOk = false;
	 						return false;
	 					}
	 				}else if(hasDataRequired == '1'){
	 					if($('[name^="'+subName+'"]:checked').length != '1'){
	 						myTestIsOk = false;
	 						return false;
	 					}
	 				}else if(!isNaN(hasDataRequired)){
	 					if(Number($('[name^="'+subName+'"]:checked').length) != Number(hasDataRequired)){
	 						myTestIsOk = false;
	 						return false;
	 					}
	 				}else{
	 					var regNumber = new RegExp("[0-9]+\\+", "ig");
	 					if(regNumber.test(hasDataRequired) == true){
	 						hasDataRequired = Number(hasDataRequired.replace('+',''));
	 						if(Number($('[name^="'+subName+'"]:checked').length) < hasDataRequired){
		 						myTestIsOk = false;
		 						return false;
	 						}
	 					}
	 				}

	 			}
	 		}else if($(this)[0].checkValidity() === false){
	 			// vérification de la validité des champs en s'appuyant sur les attributs html5
	 			myTestIsOk = false;
	 			return false;

	 		}
	 	});
		if(myTestIsOk === true){
			object = {etat:'ok'};
		}else{
			object = {etat:'ko',message:""+mess+""};
		}
		return object;
	}

	 /**
	 * [getToJson -> Permet de récupérer toutes les valeurs présentes en get dans une chaine de caractère]
	 * @param  {[string]} url [Id de l'article a afficher avec GET à la suite #idArticle?get1=valeur...]
	 * @return {[object]} myObject [Objet avec tous les "GET" sous form clé:valeur]
	 */
	 this.getToJson = function (url) {
	 	var myObject = {};
	 	if (url == "") {
	 		return myObject;
	 	}
	 	var args = url.split('?');
	 	if(args.length <= 1 || args.length > 2){
	 		return myObject;
	 	}
	 	var gets = args[1].split('&');
	 	for (var i = 0; i < gets.length; ++i){
	 		var p = gets[i].split('=', 2);
	 		if (p.length == 1){
	 			myObject[p[0]] = "";
	 		}else{
	 			myObject[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
	 		}    
	 	}
	 	return myObject;
	 };

    /**
     * [fillTemplate -> Permet de garnir un template ciblé par le selecteur en remplaçant les balises {{XXX}} par la valeur correspondante]
     * @param  {[string]} selector [Selecteur de l'element DOM dans lequel on doit remplacer les balises {{XX}} par des valeurs]
     * @return {[none]}
     */
     this.fillTemplate = function(selector){
     	var myHtml = $(selector).html();
     	var keys = myHtml.match(/{{.*}}/g);
     	if(keys == null){
     		return;
     	}
     	if(keys.length > 0){
     		for(var i=0;i<keys.length;i++){
     			var subName = keys[i].replace("{{",'').replace("}}",'');
     			var val;
     			try{
     				val = eval(subName);
     			}catch(e){
     				val = '';
     			}
     			val = val || '';
     			myHtml = myHtml.replace(keys[i],val); 			
     		}
     		$(selector).html(myHtml);
     	}
     }

	/**
	 * [objectLength -> Permet de récupérer la taille d'un tableau associatif ou d'un objet]
	 * @return {[int]} [longueur du tableau associatif ou de l'objet]
	 */
	 this.objectLength = function(obj){
	 	return Object.keys(obj).length;
	 }

	/**
	 * [showInfo -> Retourne du html de block d'information]
	 * @param  {[html]} mess    [Message que l'on souhaite afficher dans le block]
	 * @param  {[json]} options [facultatif, permet d'ajouter des options facultatives]
	 * - @option  {[string]} titre [permet de modifier le titre de block]
	 * - @option  {[string]} id [permet d'attribuer un ID au block]
	 * @return {[html]} [Html du block d'info]
	 */
	 this.showInfo = function(mess, options) {
	 	var options = options || {};
	 	var titre = options.title || "Information";
	 	var id = options.id || '';
	 	return "<div id='"+id+"' class='podShowInfo'><span class='icon-info-circle'></span><p><strong class='title'>" + titre + " :</strong><br/>" + mess + "</p></div>";
	 };

	/**
	 * [showWarn -> Retourne du html de block de warning]
	 * @param  {[html]} mess    [Message que l'on souhaite afficher dans le block]
	 * @param  {[json]} options [facultatif, permet d'ajouter des options facultatives]
	 * - @option  {[string]} titre [permet de modifier le titre de block]
	 * - @option  {[string]} id [permet d'attribuer un ID au block]
	 * @return {[html]} [Html du block de warning]
	 */
	 this.showWarn = function(mess, options) {
	 	var options = options || {};
	 	var titre = options.title || "Attention";
	 	var id = options.id || '';
	 	return "<div id='"+id+"' class='podShowWarn'><span class='icon-exclamation-triangle'></span><p><strong class='title'>" + titre + " :</strong><br/>" + mess + "</p></div>";
	 }

	/**
	 * [showErr -> Retourne du html de block d'erreur]
	 * @param  {[html]} mess    [Message que l'on souhaite afficher dans le block]
	 * @param  {[json]} options [facultatif, permet d'ajouter des options facultatives]
	 * - @option  {[string]} titre [permet de modifier le titre de block]
	 * - @option  {[string]} id [permet d'attribuer un ID au block]
	 * @return {[html]} [Html du block d'erreur]
	 */
	 this.showErr = function(mess, options) {
	 	var options = options || {};
	 	var titre = options.title || "Erreur";
	 	var id = options.id || '';
	 	return "<div id='"+id+"' class='podShowErr'><span class='icon-times-circle'></span><p><strong class='title'>" + titre + " :</strong><br/>" + mess + "</p></div>";
	 }

	/**
	 * [showConf -> Retourne du html de block de confirmation]
	 * @param  {[html]} mess    [Message que l'on souhaite afficher dans le block]
	 * @param  {[json]} options [facultatif, permet d'ajouter des options facultatives]
	 * - @option  {[string]} titre [permet de modifier le titre de block]
	 * - @option  {[string]} id [permet d'attribuer un ID au block]
	 * @return {[html]} [Html du block de confirmation]
	 */
	 this.showConf = function(mess, options) {
	 	var options = options || {};
	 	var titre = options.title || "Confirmation";
	 	var id = options.id || '';
	 	return "<div id='"+id+"' class='podShowConf'><span class='icon-check-circle'></span><p><strong class='title'>" + titre + " :</strong><br/>" + mess + "</p></div>";
	 }

	}
	var Feather = new Feather();