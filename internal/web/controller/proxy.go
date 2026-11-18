package controller

import (
	"net/http"
	"time"

	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/web/service"
	"github.com/gin-gonic/gin"
)

type ProxyController struct {
	BaseController
	proxyService *service.ProxyService
}

func NewProxyController(g *gin.RouterGroup) *ProxyController {
	c := &ProxyController{
		proxyService: service.GetProxyService(),
	}
	proxies := g.Group("/proxies")
	{
		proxies.GET("/list", c.list)
		proxies.GET("/countries", c.countries)
		proxies.POST("/ping", c.ping)
		proxies.POST("/refresh", c.refresh)
	}
	return c
}

func (a *ProxyController) list(c *gin.Context) {
	group := c.Query("group")
	country := c.Query("country")
	search := c.Query("search")

	list := a.proxyService.GetAllProxies(group, country, search)
	groups := []string{"Africa", "Asia", "Australia", "Central America", "Europe", "North America", "South America", "US DMAs"}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"obj": gin.H{
			"proxies":            list,
			"total":              len(list),
			"groups":             groups,
			"autoRefreshMinutes": 20,
		},
	})
}

func (a *ProxyController) countries(c *gin.Context) {
	summaries := a.proxyService.GetCountrySummaries()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"obj":     summaries,
	})
}

type pingRequest struct {
	Host string `json:"host"`
	Port int    `json:"port"`
	All  bool   `json:"all"`
}

func (a *ProxyController) ping(c *gin.Context) {
	var req pingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "msg": err.Error()})
		return
	}
	if req.Host != "" && req.Port > 0 {
		lat, err := a.proxyService.Ping(req.Host, req.Port, 2500*time.Millisecond)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "msg": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"obj": gin.H{
				"host":    req.Host,
				"port":    req.Port,
				"latency": lat,
				"ok":      true,
			},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "msg": "Ping complete"})
}

func (a *ProxyController) refresh(c *gin.Context) {
	a.proxyService.TriggerRefresh()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"msg":     "Proxy refresh triggered",
	})
}
